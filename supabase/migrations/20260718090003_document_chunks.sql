-- Phase 2: document_chunks テーブル（検索本体 + ベクトル）
--
-- id が「chunkId」。Claudeには引用対象の chunkId のみを返させ、
-- サーバー側で存在検証したうえで、ファイル名・ページ番号をDBから取得する (要件10 / D-1)。

create table if not exists public.document_chunks (
  id              uuid primary key default gen_random_uuid(),
  -- 文書削除時にチャンク（ベクトル）も必ず消す。孤立ベクトルによる誤出典を防ぐ (D-4)。
  document_id     uuid not null references public.documents(id) on delete cascade,
  page_number     integer not null,       -- 出典の要。必ず保持 (要件7/10)
  chunk_index     integer not null,
  content         text not null,
  token_count     integer,
  -- OpenAI text-embedding-3-small の 1536次元で固定 (D-10)。
  embedding       vector(1536) not null,
  embedding_model text not null default 'text-embedding-3-small',
  created_at      timestamptz not null default now(),
  unique (document_id, chunk_index)
);

comment on table public.document_chunks is 'チャンク本文とEmbedding。idが出典検証に使うchunkId。';
comment on column public.document_chunks.embedding is 'OpenAI text-embedding-3-small / 1536次元 / cosine。';

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);
