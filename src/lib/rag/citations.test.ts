import { describe, it, expect } from "vitest";
import { filterValidChunkIds, dedupeCitations } from "./citations";
import type { RetrievedChunk } from "./diversity";

function chunk(id: string, doc: string, page: number): RetrievedChunk {
  return { chunkId: id, documentId: doc, pageNumber: page, content: id, similarity: 1 };
}

const retrieved = [chunk("c1", "docA", 3), chunk("c2", "docA", 3), chunk("c3", "docB", 5)];

describe("filterValidChunkIds", () => {
  it("検索結果に存在するchunkIdだけ残す（存在しないIDは棄却）", () => {
    const out = filterValidChunkIds(["c1", "ghost", "c3"], retrieved);
    expect(out.map((c) => c.chunkId)).toEqual(["c1", "c3"]);
  });

  it("重複IDは除外する", () => {
    const out = filterValidChunkIds(["c1", "c1"], retrieved);
    expect(out.map((c) => c.chunkId)).toEqual(["c1"]);
  });

  it("AIが捏造したIDだけなら空", () => {
    expect(filterValidChunkIds(["x", "y"], retrieved)).toEqual([]);
  });
});

describe("dedupeCitations", () => {
  const names = new Map([
    ["docA", "就業規則.pdf"],
    ["docB", "育児介護休業規程.pdf"],
  ]);

  it("同一ファイル・同一ページの出典は重複表示しない", () => {
    // c1 と c2 はどちらも docA/3ページ → 1件に集約
    const out = dedupeCitations([chunk("c1", "docA", 3), chunk("c2", "docA", 3)], names);
    expect(out).toEqual([{ fileName: "就業規則.pdf", pageNumber: 3 }]);
  });

  it("DBにファイル名が無い文書は出典に含めない", () => {
    const out = dedupeCitations([chunk("c9", "docUnknown", 1)], names);
    expect(out).toEqual([]);
  });

  it("複数文書の出典を生成する", () => {
    const out = dedupeCitations([chunk("c1", "docA", 3), chunk("c3", "docB", 5)], names);
    expect(out).toEqual([
      { fileName: "就業規則.pdf", pageNumber: 3 },
      { fileName: "育児介護休業規程.pdf", pageNumber: 5 },
    ]);
  });
});
