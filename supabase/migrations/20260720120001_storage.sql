-- Phase 3a: PDF保存用の Storage バケットとポリシー
--
-- 非公開バケット。管理者のみ読み書き可（要件5・12）。
-- Service Role はRLSをバイパスするため、サーバー側の限定処理でも操作可能。
-- 何度実行しても安全なように if not exists / drop ... if exists を使用。

-- 非公開バケットを作成
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- storage.objects への RLS ポリシー（bucket_id = 'documents' 限定・管理者のみ）
drop policy if exists documents_bucket_admin_select on storage.objects;
create policy documents_bucket_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.is_admin());

drop policy if exists documents_bucket_admin_insert on storage.objects;
create policy documents_bucket_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.is_admin());

drop policy if exists documents_bucket_admin_update on storage.objects;
create policy documents_bucket_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());

drop policy if exists documents_bucket_admin_delete on storage.objects;
create policy documents_bucket_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());
