import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEmbeddings } from "./embeddings";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubEnv("EMBEDDING_API_KEY", "test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createEmbeddings", () => {
  it("空入力は空配列", async () => {
    const fetchImpl = vi.fn();
    const out = await createEmbeddings([], { model: "m", fetchImpl });
    expect(out).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("index順に並べ替えて返し、batchSizeで分割する", async () => {
    const fetchImpl = vi
      .fn()
      // 1バッチ目 [a,b] を index逆順で返す
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { index: 1, embedding: [2] },
            { index: 0, embedding: [1] },
          ],
        }),
      )
      // 2バッチ目 [c]
      .mockResolvedValueOnce(jsonResponse({ data: [{ index: 0, embedding: [3] }] }));

    const out = await createEmbeddings(["a", "b", "c"], {
      model: "m",
      batchSize: 2,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out).toEqual([[1], [2], [3]]);
  });

  it("429はリトライして成功する", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ data: [{ index: 0, embedding: [9] }] }));

    const out = await createEmbeddings(["x"], {
      model: "m",
      baseDelayMs: 0,
      maxRetries: 3,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(out).toEqual([[9]]);
  });

  it("リトライ上限を超えると例外", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(
      createEmbeddings(["x"], { model: "m", baseDelayMs: 0, maxRetries: 2, fetchImpl }),
    ).rejects.toThrow();
    // 初回 + リトライ2回 = 3
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
