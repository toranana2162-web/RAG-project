/**
 * 文書解析オーケストレーション (要件6)。
 * download → 抽出 → チャンク → Embedding → 保存、を冪等に実行する。
 *
 * サーバー側の限定処理として Service Role（RLSバイパス）を使う (D-2)。
 * 再処理時は既存チャンクを削除してから再投入するため、重複チャンクは生じない。
 */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractPages } from "./extract-pages";
import { chunkPages } from "./chunk-text";
import { createEmbeddings } from "@/lib/ai/embeddings";
import { ragConfig } from "@/config/rag";
import { AppError } from "@/lib/errors";

const BUCKET = "documents";

export interface ProcessResult {
  pageCount: number;
  chunkCount: number;
}

export async function processDocument(documentId: string): Promise<ProcessResult> {
  const supabase = createSupabaseAdminClient();

  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new AppError("db_error", "文書の取得に失敗しました。", 500);
  if (!doc) throw new AppError("not_found", "文書が見つかりません。", 404);

  await supabase
    .from("documents")
    .update({ status: "processing", error_message: null })
    .eq("id", documentId);

  try {
    // 1. Storageからダウンロード
    const { data: blob, error: dlError } = await supabase.storage
      .from(BUCKET)
      .download(doc.storage_path);
    if (dlError || !blob) {
      throw new AppError("download_failed", "ファイルの取得に失敗しました。", 500);
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // 2. ページ単位で抽出
    const { totalPages, pages } = await extractPages(bytes);

    // 3. チャンク分割
    const chunks = chunkPages(pages, {
      chunkSizeTokens: ragConfig.chunkSizeTokens,
      chunkOverlapTokens: ragConfig.chunkOverlapTokens,
    });

    if (chunks.length === 0) {
      // テキストが取れない = スキャンPDF等。無言成功にせず failed で明示する。
      throw new AppError(
        "no_text",
        "テキストを抽出できませんでした（スキャンPDFの可能性があります）。",
        422,
      );
    }

    // 4. Embedding生成（同一モデル・1536次元）
    const embeddings = await createEmbeddings(
      chunks.map((c) => c.content),
      { model: ragConfig.embeddingModel },
    );

    // 5. 冪等: 既存チャンクを削除してから再投入
    const { error: delErr } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId);
    if (delErr) throw new AppError("db_error", "既存チャンクの削除に失敗しました。", 500);

    const rows = chunks.map((c, i) => ({
      document_id: documentId,
      page_number: c.pageNumber,
      chunk_index: c.chunkIndex,
      content: c.content,
      token_count: c.tokenCount,
      // pgvector へは文字列形式 "[...]" で渡す（JSON配列だと array リテラル扱いになるため）
      embedding: JSON.stringify(embeddings[i]),
      embedding_model: ragConfig.embeddingModel,
    }));
    const { error: insErr } = await supabase.from("document_chunks").insert(rows);
    if (insErr) throw new AppError("db_error", "チャンクの保存に失敗しました。", 500);

    // 6. 完了
    await supabase
      .from("documents")
      .update({
        status: "completed",
        page_count: totalPages,
        chunk_count: chunks.length,
        error_message: null,
      })
      .eq("id", documentId);

    return { pageCount: totalPages, chunkCount: chunks.length };
  } catch (e) {
    const message =
      e instanceof AppError ? e.message : "処理中にエラーが発生しました。";
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);
    throw e;
  }
}
