/**
 * RAG 関連の設定集約 (要件7・8, CLAUDE.md「設定値は config へ集約する」)
 *
 * すべて環境変数で上書き可能。未指定時は要件の初期値を使う。
 * Embedding は OpenAI text-embedding-3-small / 1536次元 / cosine で固定方針 (D-10)。
 */

export interface RagConfig {
  /** 1チャンクのトークン目安 (要件7: 500〜800) */
  chunkSizeTokens: number;
  /** チャンク間オーバーラップのトークン目安 (要件7: 100〜150) */
  chunkOverlapTokens: number;
  /** ベクトル検索の取得件数 (要件8: 上位8件) */
  retrievalTopK: number;
  /** 類似度の下限。これ未満は回答生成に使わない (要件8) */
  similarityThreshold: number;
  /** 同一文書からの最大採用件数。検索結果の偏り防止 (要件8) */
  maxChunksPerDocument: number;
  /** Embeddingモデル名 (D-10) */
  embeddingModel: string;
  /** Embeddingの次元数 (D-10) */
  embeddingDimensions: number;
  /** アップロード最大バイト数 (要件5: 20MB) */
  maxUploadBytes: number;
  /** 回答生成に使う Claude モデル (D-12) */
  answerModel: string;
}

const DEFAULTS: RagConfig = {
  chunkSizeTokens: 700,
  chunkOverlapTokens: 120,
  retrievalTopK: 10,
  similarityThreshold: 0.15,
  maxChunksPerDocument: 4,
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,
  maxUploadBytes: 20 * 1024 * 1024,
  answerModel: "claude-sonnet-5",
};

function intFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`環境変数の値が整数ではありません: "${value}"`);
  }
  return parsed;
}

function floatFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`環境変数の値が数値ではありません: "${value}"`);
  }
  return parsed;
}

/** 環境変数から RagConfig を組み立てる（テスト容易性のため env を引数化） */
export function loadRagConfig(
  env: Record<string, string | undefined> = process.env,
): RagConfig {
  return {
    chunkSizeTokens: intFromEnv(env.RAG_CHUNK_SIZE_TOKENS, DEFAULTS.chunkSizeTokens),
    chunkOverlapTokens: intFromEnv(env.RAG_CHUNK_OVERLAP_TOKENS, DEFAULTS.chunkOverlapTokens),
    retrievalTopK: intFromEnv(env.RAG_RETRIEVAL_TOP_K, DEFAULTS.retrievalTopK),
    similarityThreshold: floatFromEnv(env.RAG_SIMILARITY_THRESHOLD, DEFAULTS.similarityThreshold),
    maxChunksPerDocument: intFromEnv(env.RAG_MAX_CHUNKS_PER_DOCUMENT, DEFAULTS.maxChunksPerDocument),
    embeddingModel: env.EMBEDDING_MODEL?.trim() || DEFAULTS.embeddingModel,
    embeddingDimensions: intFromEnv(env.EMBEDDING_DIMENSIONS, DEFAULTS.embeddingDimensions),
    maxUploadBytes: intFromEnv(env.RAG_MAX_UPLOAD_BYTES, DEFAULTS.maxUploadBytes),
    answerModel: env.ANSWER_MODEL?.trim() || DEFAULTS.answerModel,
  };
}

export const ragConfig = loadRagConfig();
