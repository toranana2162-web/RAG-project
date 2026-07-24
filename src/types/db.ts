/**
 * Phase 2: データベース型定義
 *
 * supabase/migrations のスキーマに対応する手書き型。
 * 将来的には `supabase gen types typescript` での自動生成へ置き換え可能。
 *
 * Embedding: OpenAI text-embedding-3-small / 1536次元 / cosine (D-10)
 */

/** 文書の処理状態 (要件13) */
export type DocumentStatus = "uploaded" | "processing" | "completed" | "failed";

/** documents テーブル1行 */
export interface DocumentRow {
  id: string;
  file_name: string;
  storage_path: string;
  /** SHA-256。重複登録防止のためUNIQUE。 */
  content_hash: string;
  byte_size: number;
  page_count: number | null;
  chunk_count: number | null;
  status: DocumentStatus;
  error_message: string | null;
  embedding_model: string;
  embedding_dim: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

/** documents への挿入時に指定する列（既定値のある列は省略可） */
export interface DocumentInsert {
  file_name: string;
  storage_path: string;
  content_hash: string;
  byte_size: number;
  uploaded_by: string;
  page_count?: number | null;
  chunk_count?: number | null;
  status?: DocumentStatus;
  error_message?: string | null;
  embedding_model?: string;
  embedding_dim?: number;
}

/** document_chunks テーブル1行。id が出典検証に使う chunkId。 */
export interface DocumentChunkRow {
  id: string;
  document_id: string;
  page_number: number;
  chunk_index: number;
  content: string;
  token_count: number | null;
  /** pgvector の vector(1536)。JS側では number[] として扱う。 */
  embedding: number[];
  embedding_model: string;
  created_at: string;
}

/** document_chunks への挿入時に指定する列 */
export interface DocumentChunkInsert {
  document_id: string;
  page_number: number;
  chunk_index: number;
  content: string;
  embedding: number[];
  token_count?: number | null;
  embedding_model?: string;
}

/** match_chunks RPC の引数 */
export interface MatchChunksArgs {
  query_embedding: number[];
  match_threshold: number;
  match_count: number;
}

/** match_chunks RPC が返す1行 */
export interface MatchChunkResult {
  chunk_id: string;
  document_id: string;
  page_number: number;
  chunk_index: number;
  content: string;
  /** cosine 類似度（1 - distance）。0〜1。 */
  similarity: number;
}
