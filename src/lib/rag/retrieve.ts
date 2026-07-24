/**
 * ベクトル検索 (要件8)。
 * 質問をEmbedding化 → match_chunks RPC → しきい値(RPC側) → 多様性制御。
 */
import "server-only";
import { createEmbeddings } from "@/lib/ai/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ragConfig } from "@/config/rag";
import { AppError } from "@/lib/errors";
import { withRetry } from "@/lib/util/retry";
import type { MatchChunkResult } from "@/types/db";
import { applyDiversity, type RetrievedChunk } from "./diversity";

export type { RetrievedChunk } from "./diversity";

export async function retrieveChunks(question: string): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await createEmbeddings([question], {
    model: ragConfig.embeddingModel,
  });

  const supabase = await createSupabaseServerClient();

  // 多様性制御で絞る前提で、topK より多めに取得する。
  const fetchCount = ragConfig.retrievalTopK * 3;

  let data: unknown;
  try {
    // 通信断はリトライ。RPCエラーも例外化してリトライ対象にする。
    const res = await withRetry(async () => {
      const r = await supabase.rpc("match_chunks", {
        // pgvector へは文字列形式 "[...]" で渡す（JSON配列だと array リテラル扱いになるため）。
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: ragConfig.similarityThreshold,
        match_count: fetchCount,
      });
      if (r.error) throw new Error(r.error.message);
      return r;
    });
    data = res.data;
  } catch {
    throw new AppError("search_failed", "検索に失敗しました。", 500);
  }

  const rows = (data ?? []) as MatchChunkResult[];
  const mapped: RetrievedChunk[] = rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    pageNumber: r.page_number,
    content: r.content,
    similarity: r.similarity,
  }));

  return applyDiversity(mapped, ragConfig.maxChunksPerDocument, ragConfig.retrievalTopK);
}
