-- Phase 2: Row Level Security (RLS)
--
-- 方針 (要件11/12, CLAUDE.md):
--   - RLSは必ず有効化する。
--   - MVPでは認証済み社員は全登録文書を検索可（読取のみ）。
--   - 文書の登録・更新・削除は管理者のみ。
--   - 認可はAPI側でも別途確認する（本RLSは多層防御の1層）。
--
-- 管理者判定は Supabase Auth の app_metadata.role を参照する。
-- app_metadata は Service Role のみ変更可能で、クライアントからは書き換えられないため
-- 認可に利用して安全（user_metadata はクライアント変更可のため使用しない）。

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

comment on function public.is_admin() is 'JWTのapp_metadata.roleがadminならtrue。認可判定に使用。';

-- ---- documents ----
alter table public.documents enable row level security;

drop policy if exists documents_select_authenticated on public.documents;
create policy documents_select_authenticated
  on public.documents
  for select
  to authenticated
  using (true);

drop policy if exists documents_insert_admin on public.documents;
create policy documents_insert_admin
  on public.documents
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists documents_update_admin on public.documents;
create policy documents_update_admin
  on public.documents
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists documents_delete_admin on public.documents;
create policy documents_delete_admin
  on public.documents
  for delete
  to authenticated
  using (public.is_admin());

-- ---- document_chunks ----
alter table public.document_chunks enable row level security;

drop policy if exists document_chunks_select_authenticated on public.document_chunks;
create policy document_chunks_select_authenticated
  on public.document_chunks
  for select
  to authenticated
  using (true);

drop policy if exists document_chunks_insert_admin on public.document_chunks;
create policy document_chunks_insert_admin
  on public.document_chunks
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists document_chunks_update_admin on public.document_chunks;
create policy document_chunks_update_admin
  on public.document_chunks
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists document_chunks_delete_admin on public.document_chunks;
create policy document_chunks_delete_admin
  on public.document_chunks
  for delete
  to authenticated
  using (public.is_admin());

-- 注意:
--   PDF取り込み時のEmbeddingバッチはService Role（RLSバイパス）で実行する想定。
--   その境界は Phase 3 のサーバーコードで厳格化する（クライアントへService Role Keyを露出させない）。
--   Storageバケットは非公開とし、必要時のみ署名付きURLで配信する（本マイグレーションの範囲外）。
