/**
 * 検索結果の多様性制御（純関数・テスト対象）(要件8)。
 * 同一文書・ページに結果が偏りすぎないよう、1文書あたりの採用件数を制限する。
 */

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  pageNumber: number;
  content: string;
  similarity: number;
}

/**
 * 類似度降順に並んだ結果から、1文書あたり最大 maxPerDocument 件までに絞り、
 * 全体で topK 件を上限に返す。
 */
export function applyDiversity(
  results: RetrievedChunk[],
  maxPerDocument: number,
  topK: number,
): RetrievedChunk[] {
  const perDocCount = new Map<string, number>();
  const out: RetrievedChunk[] = [];

  for (const chunk of results) {
    if (out.length >= topK) break;
    const count = perDocCount.get(chunk.documentId) ?? 0;
    if (count >= maxPerDocument) continue;
    perDocCount.set(chunk.documentId, count + 1);
    out.push(chunk);
  }

  return out;
}
