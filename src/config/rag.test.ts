import { describe, it, expect } from "vitest";
import { loadRagConfig } from "./rag";

describe("loadRagConfig", () => {
  it("環境変数未指定時は要件の初期値を返す", () => {
    const cfg = loadRagConfig({});
    expect(cfg.retrievalTopK).toBe(10);
    expect(cfg.embeddingModel).toBe("text-embedding-3-small");
    expect(cfg.embeddingDimensions).toBe(1536);
    expect(cfg.maxUploadBytes).toBe(20 * 1024 * 1024);
  });

  it("環境変数で上書きできる", () => {
    const cfg = loadRagConfig({
      RAG_RETRIEVAL_TOP_K: "5",
      RAG_SIMILARITY_THRESHOLD: "0.5",
      EMBEDDING_DIMENSIONS: "3072",
    });
    expect(cfg.retrievalTopK).toBe(5);
    expect(cfg.similarityThreshold).toBe(0.5);
    expect(cfg.embeddingDimensions).toBe(3072);
  });

  it("整数でない値はエラーにする（握りつぶさない）", () => {
    expect(() => loadRagConfig({ RAG_RETRIEVAL_TOP_K: "abc" })).toThrow();
  });
});
