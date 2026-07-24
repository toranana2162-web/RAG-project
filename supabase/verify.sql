-- =====================================================================
-- Phase 2 動作検証SQL（Supabase SQL Editor 用）
--
-- 使い方: セクションごとに、その範囲を選択して Run する。
--         （SQL Editor の Results は「最後に実行された文」の結果を表示するため、
--           セクション単位で選択実行するのが確実です）
--
-- セクション②③はトランザクションで実行し、最後に ROLLBACK するため
-- データベースには何も残りません（検証専用）。
-- =====================================================================


-- =====================================================================
-- ① スキーマ存在確認（そのまま全選択して Run）
--    期待: 各行の value が下記コメントの値になっていること
-- =====================================================================
select 'vector拡張 (expect 1)'          as check, count(*)::text as value from pg_extension where extname = 'vector'
union all
select 'pgcrypto拡張 (expect 1)',        count(*)::text from pg_extension where extname = 'pgcrypto'
union all
select 'documentsテーブル (expect 1)',   count(*)::text from pg_tables where schemaname='public' and tablename='documents'
union all
select 'document_chunksテーブル (expect 1)', count(*)::text from pg_tables where schemaname='public' and tablename='document_chunks'
union all
select 'match_chunks関数 (expect 1)',    count(*)::text from pg_proc where proname='match_chunks'
union all
select 'is_admin関数 (expect 1)',        count(*)::text from pg_proc where proname='is_admin'
union all
select 'RLSポリシー数 (expect 8)',       count(*)::text from pg_policies where schemaname='public' and tablename in ('documents','document_chunks')
union all
select 'embedding列の型 (expect vector(1536))',
       format_type(atttypid, atttypmod)
  from pg_attribute
 where attrelid = 'public.document_chunks'::regclass and attname = 'embedding';


-- =====================================================================
-- ② ベクトル検索(match_chunks) + カスケード削除の検証
--    セクション②全体（begin〜rollback）を選択して Run
--
--    期待される最終結果:
--      match_count_expect_1        = 1     （直交するBは閾値0.5未満で除外）
--      top_doc_starts_with_aaaa    = t     （最上位が文書A）
--      chunksA_after_delete_expect0 = 0    （文書A削除でチャンクもcascade削除）
-- =====================================================================
begin;

-- FKチェックを一時的に無効化して、テスト用の文書/チャンクを投入
-- （uploaded_by の auth.users FK を回避するため。cascade検証の直前に戻す）
set local session_replication_role = replica;

insert into public.documents (id, file_name, storage_path, content_hash, byte_size, uploaded_by, status) values
  ('aaaaaaaa-0000-0000-0000-00000000aaaa','A.pdf','a','verify-hash-A',1000, gen_random_uuid(), 'completed'),
  ('bbbbbbbb-0000-0000-0000-00000000bbbb','B.pdf','b','verify-hash-B',1000, gen_random_uuid(), 'completed');

-- チャンクA: 第1次元=1方向 / チャンクB: 第2次元=1方向（Aと直交）
insert into public.document_chunks (document_id, page_number, chunk_index, content, embedding)
select 'aaaaaaaa-0000-0000-0000-00000000aaaa', 1, 0, 'chunk A',
       (select array_agg(case when i=1 then 1.0::float8 else 0.0::float8 end order by i)::vector
          from generate_series(1,1536) as g(i));
insert into public.document_chunks (document_id, page_number, chunk_index, content, embedding)
select 'bbbbbbbb-0000-0000-0000-00000000bbbb', 1, 0, 'chunk B',
       (select array_agg(case when i=2 then 1.0::float8 else 0.0::float8 end order by i)::vector
          from generate_series(1,1536) as g(i));

-- FKチェックを通常へ戻す（この後の delete で ON DELETE CASCADE を効かせる）
set local session_replication_role = default;

-- 質問ベクトル=第1次元方向。閾値0.5・上位8件で検索した結果を一時保存
create temp table _m on commit drop as
select * from public.match_chunks(
  (select array_agg(case when i=1 then 1.0::float8 else 0.0::float8 end order by i)::vector
     from generate_series(1,1536) as g(i)),
  0.5, 8);

-- 文書Aを削除（cascadeでチャンクAも消えるはず）
delete from public.documents where id = 'aaaaaaaa-0000-0000-0000-00000000aaaa';

-- 最終結果（この1行が Results に表示される）
select
  (select count(*) from _m)                                                   as match_count_expect_1,
  (select (document_id::text like 'aaaaaaaa%') from _m order by similarity desc limit 1) as top_doc_starts_with_aaaa,
  (select count(*) from public.document_chunks
     where document_id = 'aaaaaaaa-0000-0000-0000-00000000aaaa')              as chunksA_after_delete_expect0;

rollback;


-- =====================================================================
-- ③ RLS 検証（非管理者は select 可 / insert 不可）
--    セクション③全体（begin〜rollback）を選択して Run
--
--    期待される挙動:
--      - is_admin() は false
--      - select は成功（件数が返る）
--      - 最後の INSERT は「エラー」になるのが正解
--        エラーメッセージに "row-level security policy" が含まれれば合格。
--        （FK関連のエラーが出た場合は、RLSが想定外に通過した可能性 → 連絡ください）
-- =====================================================================
begin;

-- 非管理者ユーザーのJWTクレームを擬似設定（app_metadata.role なし = 一般社員）
select set_config(
  'request.jwt.claims',
  '{"sub":"000000ff-0000-0000-0000-0000000000ff","role":"authenticated","app_metadata":{}}',
  true
);
set local role authenticated;

-- is_admin は false のはず
select 'is_admin (expect false)' as label, public.is_admin() as value;

-- select は許可される（エラーにならず件数が返る）
select 'select as non-admin (expect a number, no error)' as label, count(*)::text as value
from public.documents;

-- ↓ RLSにより拒否されるのが正解（エラーになる）
insert into public.documents (file_name, storage_path, content_hash, byte_size, uploaded_by)
values ('x.pdf', 'p', 'verify-hash-X', 100, '000000ff-0000-0000-0000-0000000000ff');

rollback;
