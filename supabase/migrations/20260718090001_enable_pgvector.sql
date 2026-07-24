-- Phase 2: pgvector 拡張の有効化
-- 社内文書検索AI（RAG）MVP
--
-- Embedding: OpenAI text-embedding-3-small / 1536次元 / cosine similarity (D-10)

create extension if not exists vector;

-- gen_random_uuid() 用（Supabaseでは既定で有効だが明示する）
create extension if not exists pgcrypto;
