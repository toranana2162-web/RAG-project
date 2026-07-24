import { describe, it, expect } from "vitest";
import { applyDiversity, type RetrievedChunk } from "./diversity";

function chunk(id: string, doc: string, sim: number): RetrievedChunk {
  return { chunkId: id, documentId: doc, pageNumber: 1, content: id, similarity: sim };
}

describe("applyDiversity", () => {
  it("1文書あたり最大件数を超えない", () => {
    const results = [
      chunk("a1", "docA", 0.9),
      chunk("a2", "docA", 0.8),
      chunk("a3", "docA", 0.7),
      chunk("b1", "docB", 0.6),
    ];
    const out = applyDiversity(results, 2, 10);
    expect(out.map((c) => c.chunkId)).toEqual(["a1", "a2", "b1"]);
  });

  it("topK で全体件数を打ち切る", () => {
    const results = [
      chunk("a1", "docA", 0.9),
      chunk("b1", "docB", 0.8),
      chunk("c1", "docC", 0.7),
    ];
    const out = applyDiversity(results, 5, 2);
    expect(out.map((c) => c.chunkId)).toEqual(["a1", "b1"]);
  });

  it("入力の順序（類似度降順）を維持する", () => {
    const results = [chunk("a1", "docA", 0.9), chunk("b1", "docB", 0.5)];
    const out = applyDiversity(results, 5, 5);
    expect(out.map((c) => c.chunkId)).toEqual(["a1", "b1"]);
  });
});
