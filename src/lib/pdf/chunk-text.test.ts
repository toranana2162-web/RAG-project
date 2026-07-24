import { describe, it, expect } from "vitest";
import { splitText, chunkPages, APPROX_CHARS_PER_TOKEN } from "./chunk-text";
import type { PageText } from "./extract-pages";

describe("splitText", () => {
  it("空文字は空配列", () => {
    expect(splitText("", 100, 20)).toEqual([]);
    expect(splitText("   \n\n  ", 100, 20)).toEqual([]);
  });

  it("短いテキストは1チャンク", () => {
    expect(splitText("短い文章です。", 100, 20)).toEqual(["短い文章です。"]);
  });

  it("長いテキストは複数チャンクに分割され、各チャンクは target+overlap 以内", () => {
    const target = 50;
    const overlap = 10;
    const text = Array.from({ length: 20 }, (_, i) => `段落${i}の内容テキストです。`).join("\n\n");
    const chunks = splitText(text, target, overlap);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(target + overlap);
    }
  });

  it("段落より長い1段落はハード分割される", () => {
    const target = 20;
    const long = "あ".repeat(100);
    const chunks = splitText(long, target, 5);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(target);
  });
});

describe("chunkPages", () => {
  it("ページ番号を保持し、chunkIndexは連番", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: "一ページ目。".repeat(30) },
      { pageNumber: 5, text: "五ページ目。" },
    ];
    const chunks = chunkPages(pages, { chunkSizeTokens: 10, chunkOverlapTokens: 2 });

    // chunkIndex は 0..n-1 の連番
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));

    // ページ1のチャンクは pageNumber=1、最後のチャンクは pageNumber=5
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[chunks.length - 1].pageNumber).toBe(5);

    // tokenCount は文字数からの近似
    for (const c of chunks) {
      expect(c.tokenCount).toBe(Math.ceil(c.content.length / APPROX_CHARS_PER_TOKEN));
    }
  });

  it("チャンクは必ず単一ページに属する（ページ跨ぎしない）", () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: "AAAA" },
      { pageNumber: 2, text: "BBBB" },
    ];
    const chunks = chunkPages(pages, { chunkSizeTokens: 100, chunkOverlapTokens: 0 });
    const p1 = chunks.filter((c) => c.pageNumber === 1);
    const p2 = chunks.filter((c) => c.pageNumber === 2);
    expect(p1.every((c) => c.content.includes("A") && !c.content.includes("B"))).toBe(true);
    expect(p2.every((c) => c.content.includes("B") && !c.content.includes("A"))).toBe(true);
  });
});
