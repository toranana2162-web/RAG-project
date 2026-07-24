-- Phase 2: ベクトル検索インデックス
--
-- 距離指標は cosine similarity (D-10) のため vector_cosine_ops を使用する。
-- ivfflat は 200本規模のMVPに十分。件数が大きく増える場合は hnsw への移行を検討する。
--
-- 注意: ivfflat インデックスはデータ投入後に作成すると精度が安定する。
-- MVPの初期データ投入前でも作成できるが、本格投入後の REINDEX を推奨する。

create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
