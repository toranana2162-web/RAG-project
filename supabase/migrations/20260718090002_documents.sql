-- Phase 2: documents テーブル（文書メタ）
--
-- 出典（ファイル名・ページ番号）はここと document_chunks からサーバー側で取得する。
-- AIが生成したファイル名は使用しない (要件10 / D-1)。

-- 処理状態 (要件13)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type public.document_status as enum (
      'uploaded',
      'processing',
      'completed',
      'failed'
    );
  end if;
end
$$;

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  file_name      text not null,
  storage_path   text not null,
  -- SHA-256 による重複登録防止 (要件5)。アプリ側チェックと二重で担保する。
  content_hash   text not null unique,
  byte_size      integer not null check (byte_size > 0 and byte_size <= 20 * 1024 * 1024),
  page_count     integer,
  chunk_count    integer,
  status         public.document_status not null default 'uploaded',
  error_message  text,
  -- Embeddingモデル名・次元数をDBへ記録する (D-10)。モデル変更時の再Embedding判定に使う。
  embedding_model text not null default 'text-embedding-3-small',
  embedding_dim   integer not null default 1536,
  uploaded_by    uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.documents is '登録PDFのメタ情報。出典表示の一次ソース。';
comment on column public.documents.content_hash is 'SHA-256。重複登録防止のためUNIQUE。';
comment on column public.documents.status is 'uploaded/processing/completed/failed。';

-- updated_at 自動更新トリガ
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.set_updated_at();
