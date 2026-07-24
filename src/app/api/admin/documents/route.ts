/**
 * 管理者向け 文書API。
 * - POST: PDFアップロード（検証→重複確認→Storage保存→documents作成, status=uploaded）
 * - GET : 文書一覧
 *
 * すべて requireAdmin() で権限を再確認する（middleware任せにしない・要件11）。
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertValidPdf, sha256Hex } from "@/lib/validation/pdf-upload";
import { ragConfig } from "@/config/rag";
import { AppError, toErrorResponse } from "@/lib/errors";

export const runtime = "nodejs";

const BUCKET = "documents";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("no_file", "ファイルが指定されていません。", 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    assertValidPdf(
      {
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        header: bytes.subarray(0, 5),
      },
      ragConfig.maxUploadBytes,
    );

    const hash = sha256Hex(bytes);
    const supabase = await createSupabaseServerClient();

    // 重複チェック（アプリ側 + DBのUNIQUE制約で二重に担保）
    const { data: existing } = await supabase
      .from("documents")
      .select("id")
      .eq("content_hash", hash)
      .maybeSingle();
    if (existing) {
      throw new AppError("duplicate", "同じ内容のファイルが既に登録されています。", 409);
    }

    const storagePath = `${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      throw new AppError("upload_failed", "ファイルの保存に失敗しました。", 500);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("documents")
      .insert({
        file_name: file.name,
        storage_path: storagePath,
        content_hash: hash,
        byte_size: file.size,
        uploaded_by: user.id,
        status: "uploaded",
        embedding_model: ragConfig.embeddingModel,
        embedding_dim: ragConfig.embeddingDimensions,
      })
      .select("id, file_name, status, created_at")
      .single();

    if (insertError) {
      // DB登録に失敗したらStorageの実体を掃除する（孤立ファイル防止）。
      await supabase.storage.from(BUCKET).remove([storagePath]);
      if (insertError.code === "23505") {
        throw new AppError("duplicate", "同じ内容のファイルが既に登録されています。", 409);
      }
      throw new AppError("db_error", "登録に失敗しました。", 500);
    }

    return NextResponse.json({ document: inserted }, { status: 201 });
  } catch (e) {
    const { status, body } = toErrorResponse(e);
    return NextResponse.json(body, { status });
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, file_name, status, page_count, chunk_count, error_message, byte_size, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) {
      throw new AppError("db_error", "一覧の取得に失敗しました。", 500);
    }
    return NextResponse.json({ documents: data ?? [] });
  } catch (e) {
    const { status, body } = toErrorResponse(e);
    return NextResponse.json(body, { status });
  }
}
