/**
 * 出典検証 (要件10)。
 * AIが返した chunkId を検索結果と突合し、実在するものだけを採用。
 * ファイル名は documents テーブルから取得（AI出力のファイル名は使わない）。
 */
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/util/retry";
import { filterValidChunkIds, dedupeCitations, type Citation } from "./citations";
import type { RetrievedChunk } from "./diversity";

export type { Citation } from "./citations";

export async function buildCitations(
  citedChunkIds: string[],
  retrieved: RetrievedChunk[],
): Promise<Citation[]> {
  const validChunks = filterValidChunkIds(citedChunkIds, retrieved);
  if (validChunks.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const documentIds = [...new Set(validChunks.map((c) => c.documentId))];
  const { data } = await withRetry(
    async () =>
      await supabase.from("documents").select("id, file_name").in("id", documentIds),
  );

  const fileNameByDocumentId = new Map<string, string>(
    (data ?? []).map((d: { id: string; file_name: string }) => [d.id, d.file_name]),
  );

  return dedupeCitations(validChunks, fileNameByDocumentId);
}
