/**
 * RAG回答生成の統合 (要件8・9・10)。
 * 検索 → (0件なら回答不能) → Claude → chunkId検証・出典生成。
 *
 * 「回答可能だが検証済み出典が0件」も回答不能として扱う
 * （出典を提示できない回答は信用しないため）。
 */
import "server-only";
import { retrieveChunks } from "./retrieve";
import { buildCitations } from "./validate-citations";
import { generateGroundedAnswer } from "@/lib/ai/claude";
import { UNANSWERABLE_MESSAGE } from "@/lib/ai/prompts";
import type { Citation } from "./citations";

export interface ChatAnswer {
  answerable: boolean;
  answer: string;
  citations: Citation[];
}

function unanswerable(): ChatAnswer {
  return { answerable: false, answer: UNANSWERABLE_MESSAGE, citations: [] };
}

export async function answerQuestion(question: string): Promise<ChatAnswer> {
  const chunks = await retrieveChunks(question);
  if (chunks.length === 0) {
    return unanswerable();
  }

  const result = await generateGroundedAnswer(
    question,
    chunks.map((c) => ({ chunkId: c.chunkId, content: c.content })),
  );
  if (!result.answerable) {
    return unanswerable();
  }

  const citations = await buildCitations(result.citedChunkIds, chunks);
  // 検証済み出典が無い回答は信用しない → 回答不能扱い。
  if (citations.length === 0) {
    return unanswerable();
  }

  return { answerable: true, answer: result.answer, citations };
}
