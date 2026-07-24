/**
 * OpenAI Embedding クライアント (D-10)。
 * text-embedding-3-small / 1536次元。追加SDKは使わず fetch で実装。
 *
 * レート制限・一時エラーに対して指数バックオフでリトライする（レビューH-3）。
 * 文書チャンクと質問文で同一モデルを使うこと（呼び出し側で ragConfig を渡す）。
 */
import "server-only";
import { AppError } from "@/lib/errors";

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

export interface EmbeddingOptions {
  model: string;
  /** 1リクエストあたりの入力数（OpenAIの上限とレイテンシのバランス） */
  batchSize?: number;
  maxRetries?: number;
  /** バックオフ基準ms（テストで0にできる） */
  baseDelayMs?: number;
  /** テスト用の fetch 差し替え */
  fetchImpl?: typeof fetch;
}

interface OpenAIEmbeddingResponse {
  data: { index: number; embedding: number[] }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 複数テキストのEmbeddingを、入力順に対応した配列で返す。 */
export async function createEmbeddings(
  inputs: string[],
  options: EmbeddingOptions,
): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const apiKey = process.env.EMBEDDING_API_KEY;
  if (!apiKey) {
    throw new AppError("config_error", "EMBEDDING_API_KEY が未設定です。", 500);
  }

  const batchSize = options.batchSize ?? 100;
  const doFetch = options.fetchImpl ?? fetch;

  const results: number[][] = [];
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch, apiKey, doFetch, options);
    results.push(...embeddings);
  }
  return results;
}

async function embedBatch(
  batch: string[],
  apiKey: string,
  doFetch: typeof fetch,
  options: EmbeddingOptions,
): Promise<number[][]> {
  const maxRetries = options.maxRetries ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 500;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await doFetch(OPENAI_EMBEDDINGS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: options.model, input: batch }),
      });

      // レート制限・サーバーエラーはリトライ対象
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(baseDelayMs * 2 ** attempt);
          continue;
        }
        throw new AppError("embedding_failed", "Embedding生成に失敗しました。", 502);
      }

      if (!res.ok) {
        // 400系（リトライ不可）
        throw new AppError("embedding_failed", "Embedding生成に失敗しました。", 502);
      }

      const json = (await res.json()) as OpenAIEmbeddingResponse;
      // index順に並べ直して返す
      return json.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (e) {
      if (e instanceof AppError) throw e;
      // ネットワークエラー等はリトライ
      if (attempt < maxRetries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
    }
  }

  throw new AppError(
    "embedding_failed",
    "Embedding生成に失敗しました（リトライ上限）。",
    502,
  );
}
