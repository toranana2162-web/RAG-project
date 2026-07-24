-- Phase 2: ベクトル検索RPC
--
-- ユーザー入力をSQL文字列へ埋め込まず、パラメータ化した関数として検索する (D-5, CLAUDE.md)。
-- 類似度は cosine similarity。pgvector の <=> は cosine distance のため similarity = 1 - distance。
--
-- 返却する document_id / page_number / content は Phase 4 で出典生成に使う。
-- ファイル名は呼び出し側で documents から取得（AI生成値は使わない）。

create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  chunk_id     uuid,
  document_id  uuid,
  page_number  integer,
  chunk_index  integer,
  content      text,
  similarity   float
)
language sql
stable
-- security invoker（既定）: 呼び出しユーザーのRLSが適用される。
-- 将来の部署別ACL(Phase 2以降)でもRLSがそのまま効くようにするため。
as $$
  select
    c.id            as chunk_id,
    c.document_id   as document_id,
    c.page_number   as page_number,
    c.chunk_index   as chunk_index,
    c.content       as content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  where 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding asc
  limit match_count;
$$;

comment on function public.match_chunks is
  'cosine類似度で document_chunks を検索。閾値以上を上位match_count件返す。ユーザー入力はパラメータ化。';

-- 匿名からの実行を禁止し、認証済みユーザーにのみ実行を許可する。
revoke all on function public.match_chunks(vector, float, int) from public;
revoke all on function public.match_chunks(vector, float, int) from anon;
grant execute on function public.match_chunks(vector, float, int) to authenticated;
