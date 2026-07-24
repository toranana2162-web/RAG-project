import { describe, it, expect, vi, beforeEach } from "vitest";
import { UNANSWERABLE_MESSAGE } from "@/lib/ai/prompts";
import type { RetrievedChunk } from "./diversity";

vi.mock("./retrieve", () => ({ retrieveChunks: vi.fn() }));
vi.mock("@/lib/ai/claude", () => ({ generateGroundedAnswer: vi.fn() }));
vi.mock("./validate-citations", () => ({ buildCitations: vi.fn() }));

import { answerQuestion } from "./generate-answer";
import { retrieveChunks } from "./retrieve";
import { generateGroundedAnswer } from "@/lib/ai/claude";
import { buildCitations } from "./validate-citations";

const mockRetrieve = vi.mocked(retrieveChunks);
const mockGenerate = vi.mocked(generateGroundedAnswer);
const mockCitations = vi.mocked(buildCitations);

const chunk: RetrievedChunk = {
  chunkId: "c1",
  documentId: "d1",
  pageNumber: 1,
  content: "本文",
  similarity: 0.9,
};

beforeEach(() => vi.clearAllMocks());

describe("answerQuestion", () => {
  it("検索結果0件なら回答不能（Claudeを呼ばない）", async () => {
    mockRetrieve.mockResolvedValue([]);
    const r = await answerQuestion("q");
    expect(r).toEqual({ answerable: false, answer: UNANSWERABLE_MESSAGE, citations: [] });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("Claudeがanswerable=falseなら回答不能（出典検証を呼ばない）", async () => {
    mockRetrieve.mockResolvedValue([chunk]);
    mockGenerate.mockResolvedValue({ answerable: false, answer: "…", citedChunkIds: [] });
    const r = await answerQuestion("q");
    expect(r.answerable).toBe(false);
    expect(r.answer).toBe(UNANSWERABLE_MESSAGE);
    expect(mockCitations).not.toHaveBeenCalled();
  });

  it("回答可能でも検証済み出典が0件なら回答不能（出典なしは信用しない）", async () => {
    mockRetrieve.mockResolvedValue([chunk]);
    mockGenerate.mockResolvedValue({ answerable: true, answer: "回答", citedChunkIds: ["c1"] });
    mockCitations.mockResolvedValue([]);
    const r = await answerQuestion("q");
    expect(r.answerable).toBe(false);
    expect(r.answer).toBe(UNANSWERABLE_MESSAGE);
  });

  it("正常系: 回答と検証済み出典を返す", async () => {
    mockRetrieve.mockResolvedValue([chunk]);
    mockGenerate.mockResolvedValue({ answerable: true, answer: "回答", citedChunkIds: ["c1"] });
    mockCitations.mockResolvedValue([{ fileName: "就業規則.pdf", pageNumber: 12 }]);
    const r = await answerQuestion("q");
    expect(r).toEqual({
      answerable: true,
      answer: "回答",
      citations: [{ fileName: "就業規則.pdf", pageNumber: 12 }],
    });
  });
});
