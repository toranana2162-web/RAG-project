# TASKS

## Phase 0：設計

- [ ] 要件定義を作成
- [ ] アーキテクチャ設計を作成
- [ ] Claude Codeによる設計レビュー
- [ ] 設計レビューの反映

---

## Phase 1：プロジェクト基盤

- [x] Next.jsプロジェクト作成（Next 16 / App Router / src-dir）
- [x] TypeScript設定（strict）
- [x] Tailwind CSS設定（v4）
- [x] Supabase接続（browser / server / admin の3クライアント + @supabase/ssr）
- [x] 開発環境構築（Vitest、config/rag.ts、.env.local.example、npmスクリプト）
- [x] lint / typecheck / test / build がすべて成功
- [x] 実Supabaseプロジェクト（東京）作成と .env.local 設定（2026-07-18 完了）
- [x] Phase 2マイグレーションの実適用・動作検証（SQL Editor経由で完了）

---

## Phase 2：データベース

- [x] pgvector導入（0001_enable_pgvector.sql）
- [x] documentsテーブル（0002_documents.sql）
- [~] document_pagesテーブル … MVPでは省略に決定（chunksで出典・検索が成立するため）
- [x] document_chunksテーブル（0003_document_chunks.sql / vector(1536)）
- [x] RLS設定（0005_rls_policies.sql / 管理者判定は app_metadata.role）
- [x] ベクトル検索index（0004_indexes.sql / ivfflat cosine）
- [x] match_chunks RPC（0006_match_chunks_rpc.sql）
- [x] DB型定義（src/types/db.ts）
- [x] 実適用: ホスティング型Supabase（東京）へ SQL Editor 経由で適用（2026-07-18）
- [x] 検証済み: スキーマ存在確認（拡張/テーブル/関数/ポリシー8/embedding vector(1536)）
- [x] 検証済み: match_chunks（閾値で直交チャンク除外・最類似が正しい）
- [x] 検証済み: RLS（非管理者のINSERTを 42501 で拒否・SELECTは許可）
- [x] 検証済み: ON DELETE CASCADE（文書削除でチャンクも削除）
- 注: マイグレーションは CLI 互換のためタイムスタンプ形式へリネーム済み
  （0001〜0006 → 20260718090001〜090006_*.sql。内容・順序は不変）
- 注: 一括適用用 supabase/apply_all.sql、検証用 supabase/verify.sql を追加
- 注: CLI login が非TTYで不可のため今回は SQL Editor で適用。
  将来 db push を使う場合は supabase migration repair で履歴を合わせる

---

## Phase 2.5：認証・認可（設計レビューで前倒し新設）

- [x] middleware によるルート保護（未認証→/login、/admin は管理者のみ）
- [x] Supabase セッション更新ヘルパ（@supabase/ssr）
- [x] 認可ヘルパ（getCurrentUser / getAllowedUser / requireUser / requireAdmin）
- [x] 許可ドメイン判定（純関数・fail-safeで未設定時は全拒否）
- [x] マジックリンク・ログイン（送信前＋コールバック後の二重ドメイン検証）
- [x] /auth/confirm（token_hash）・/auth/callback（code）・/auth/signout
- [x] /chat・/admin/documents の保護シェル（ページ側でも権限確認）
- [x] ユニットテスト（email-domain 8件 / user 5件）
- [x] lint / typecheck / test(16) / build すべて成功
- [x] Supabase ダッシュボード設定（2026-07-20 完了）
      - Auth → URL Configuration: Site URL=http://localhost:3000 / Redirect URLs に /auth/confirm
      - メールテンプレート（Magic link or OTP）を token_hash 形式へ変更
      - 自分のアカウントを app_metadata.role='admin' に更新（SQL）
- [x] 実ログインE2E 検証完了（2026-07-20）
      - 未認証 → /login リダイレクト
      - 許可ドメインでマジックリンク送信・ログイン成功（/auth/confirm→/chat 200）
      - 管理者化＋再ログインで /admin/documents 利用可・「文書管理」リンク表示
      - 学び: localhost リンクはPCで開く必要あり（スマホでは到達しない）

---

## Phase 3：PDF取り込み

実行方式：同期API（1文書ずつ・maxDuration延長・冪等リトライ）に確定（設計レビューPhase A）。

### ステップ3a：登録基盤（完了 2026-07-20）
- [x] Storageバケット documents（非公開）+ 管理者限定ポリシー（migration 20260720120001）
- [x] アップロードAPI POST /api/admin/documents（検証・SHA-256・Storage保存・uploaded作成）
- [x] 一覧 GET /api/admin/documents、削除 DELETE /api/admin/documents/[id]（DB+Storage）
- [x] 検証（MIME+拡張子+マジックバイト+20MB）と重複防止（content_hash）
- [x] 最小アップロードUI（見た目はPhase 5）
- [x] テスト（pdf-upload 9件）/ lint / typecheck / test(25) / build 成功
- [x] storageマイグレーション適用・実アップロード/一覧/削除を確認（2026-07-20）

### ステップ3b：解析パイプライン（実装完了 2026-07-21）
- [x] PDF解析（unpdf・ページ単位抽出・空白ページ除外）
- [x] チャンク分割（ページ単位・サイズ/オーバーラップ・ページ番号厳密保持）
- [x] Embedding生成（OpenAI text-embedding-3-small・fetch+指数バックオフ）
- [x] 処理/再処理API（冪等・状態遷移 processing→completed/failed・maxDuration=300）
- [x] スキャンPDF等でテキスト0件なら failed で明示（無言成功にしない）
- [x] 管理UIに「処理/再処理」ボタン追加
- [x] テスト（chunk-text 6件 / embeddings 4件）/ lint / typecheck / test(35) / build 成功
- [x] .env.local に EMBEDDING_API_KEY(OpenAI) を設定し dev 再起動（2026-07-21）
- [x] 実PDF複数本でアップロード→処理→completed・チャンク保存を確認（2026-07-21）

→ Phase 3（PDF取り込み）は 3a・3b とも実環境で検証完了。次は Phase 4（RAG検索）。

---

## Phase 4：RAG検索（実装完了 2026-07-21）

- [x] ベクトル検索（retrieve: 質問Embedding→match_chunks→しきい値→多様性制御）
- [x] Claude API連携（claude.ts: Sonnet 5・公式SDK・構造化出力・思考オフ）
- [x] プロンプト（データ区画・回答不能ルール・インジェクション対策）
- [x] chunkId検証＋出典生成（DB由来・重複排除、AI出力のファイル名は不使用）
- [x] 回答不能の正常処理（検索0件/answerable false/出典0件 → 定型文）
- [x] /api/chat（requireUser・zod検証・{answer,answerable,citations}）
- [x] 最小チャットUI（質問→回答→出典表示）
- [x] テスト（diversity 3 / citations 6 / prompts 3）/ lint / typecheck / test(47) / build 成功
- [x] .env.local に ANTHROPIC_API_KEY を設定し dev 再起動（2026-07-21）
- [x] 実質問で回答＋出典表示・回答不能ケースを確認（2026-07-21、/api/chat 200・エラーなし）

→ Phase 4（RAG検索）は実環境で検証完了。次は Phase 5（UI仕上げ）/ Phase 6（テスト・精度評価・本番準備）。

---

## Phase 5：UI（実装完了 2026-07-23）

- [x] 共通UI（Button / Spinner / Card / StatusBadge / AppHeader）とライトテーマ統一
- [x] チャット画面: 会話ログ表示・送信中スピナー・Enter送信/Shift+Enter改行・
      出典カード・回答不能のグレー表示・空状態・自動スクロール（1問1答は維持）
- [x] 管理画面: 文書一覧カード＋状態バッジ・ページ/チャンク数・日時・サイズ、
      アップロード進行/フィードバック、空状態、処理/再処理/削除ボタン整理
- [x] ログイン画面の整え、layout metadata（lang=ja / タイトル）
- [x] エラー表示（各画面インライン）・レスポンシブ対応
- [x] lint / typecheck / test(47) / build 成功、dev で描画確認（/login 200・新UI配信）

---

## Phase 6：テスト・本番準備

### ステップ6a：精度評価ハーネス（実装完了 2026-07-21）
- [x] 評価ランナー scripts/eval/run-eval.ts（検索→回答→judge→出典検証→集計）
- [x] LLM-as-judge で正答判定（judgeモデルは JUDGE_MODEL / 既定 answerModel）
- [x] 4指標を集計（正答率≥80% / 出典表示率100% / 誤回答率≤10% / 参考: 検索・出典正解率）
- [x] データテンプレート scripts/eval/dataset.example.json、npm run eval 追加、tsx 導入
- [x] .gitignore に実データ/結果を追加（社内文書由来のため）
- [x] サンプルデータで疎通スモーク成功（配管確認・lint/typecheck/test47/build 通過）
- [x] 実PDFから60問の評価データ scripts/eval/dataset.json を作成（人間）
- [x] npm run eval で測定 → 正答率100%/出典表示率100%/誤回答率0%（要件14合格・2026-07-23）
- [x] チューニング: しきい値0.15/topK10/maxPerDoc4（D-13）、doc5再アップロードでファイル名解消
- [x] 診断ツール scripts/eval/probe.ts を追加（検索結果の可視化）

→ ステップ6a（精度評価）完了。要件14の合格基準を実データで達成。

### ステップ6b：本番準備（実装完了 2026-07-24）
- [x] 結合テスト追加: generate-answer（回答不能分岐）/ /api/chat（401・400・正常）/
      /api/admin/documents（401・403）。next/headers スタブ導入。テスト計57件。
- [x] README 作成（概要・アーキ・セットアップ・実行・精度評価・セキュリティ・デプロイ）
- [x] npm audit: high3件（next同梱のpostcss/sharp）を overrides で解消 → 脆弱性0。
      next 16.2.10→16.2.11 も更新。
- [x] 本番ビルド（build）・本番起動（start）確認、lint/typecheck/test(57) 通過
- [x] 実デプロイ完了（2026-07-25）: Vercel 本番 https://rag-prpject.vercel.app
      環境変数7件設定・Supabase本番URL登録・マジックリンクログイン疎通確認済み
- 注: 本番認証は Site URL=本番URL + テンプレート {{ .SiteURL }}/auth/confirm 方式で確定。
      （{{ .RedirectTo }} 方式はリンク不正の可能性があり不採用）

---

## 設計レビュー反映TODO（2026-07-16 追記）

Claude Codeによる設計レビュー結果を反映したTODO。
既存のPhase構成は維持しつつ、レビューで判明した論点を各Phaseへ追記する。

### Phase 0（着手前に人間が判断すべき事項）

- [x] Embeddingモデルと次元数を確定する（外部APIへ社内文書テキストを送る可否を含む）
      → text-embedding-3-small / 1536次元 / cosine に確定（D-10）。外部送信は許容前提（運用前に顧客最終確認）。
- [ ] PDF解析の実行環境を決定する（Supabase Edge Function / 別ワーカー / ローカルバッチ）
- [ ] ホスティング先とサーバーレス実行タイムアウト上限を確定する
- [ ] 許可メールドメインと管理者ロール付与方法を決める
- [ ] 質問ログの保存可否・保持期間を決める（監査 vs 機密）
- [ ] 原本PDFの閲覧可否（署名付きURLの要否）を決める
- [ ] 精度評価用30問の作成主体とスケジュールを決める
- [ ] スキャンPDF（画像PDF）混在有無を確認する

### Phase 1（基盤）に追加

- [ ] TypeScript strict / zod等による入出力スキーマ検証の土台
- [ ] 3種Supabaseクライアント分離、Service Role Keyのクライアント混入防止

### Phase 2（DB）に追加

- [ ] Embeddingモデル確定後にvector(N)次元を固定
- [ ] document_chunks / document_pages に ON DELETE CASCADE を設定
- [ ] documents.content_hash に UNIQUE 制約
- [ ] status を CHECK制約またはenum化、error_message/embedding_model等の列を追加
- [ ] ベクトルindex（初期はivfflat）をデータ投入後に作成、距離演算子をモデルと一致
- [ ] 検索はパラメータ化RPC（match_chunks）に閉じる
- [ ] document_pages の採否と役割を確定

### Phase 3（PDF取り込み・解析）に追加

- [ ] アップロードAPIと解析処理を分離（POSTは uploaded を即返す）
- [ ] 非同期解析パイプライン（processing→抽出→チャンク→Embedding→保存→completed/failed）
- [ ] Embedding/Claude APIのリトライ（指数バックオフ）と部分失敗回復・冪等性
- [ ] failed からの再処理導線（reprocessエンドポイント）
- [ ] マジックバイト（%PDF-）による実体検証、20MB上限のサーバー側強制

### Phase 4（RAG検索）に追加

- [ ] 類似度しきい値・距離指標・多様性制御（1文書あたり最大N件）の実装
- [ ] chunkId存在検証（存在しないIDは棄却）
- [ ] 出典はDBから取得（AI出力のファイル名/ページ番号を信用しない）
- [ ] 回答不能を answerable=false ＋定型文で返す
- [ ] プロンプト内で検索結果をデータ区画として明示（インジェクション対策）

### Phase 5（UI）に追加

- [ ] MVPは1問1答（ステートレス）であることをUIに明記
- [ ] 管理画面に処理状態・エラー内容・再処理導線を表示

### Phase 6（テスト・本番準備）に追加

- [ ] ユニット: chunk-text / validate-citations / retrieve / ファイル検証 / 認可判定
- [ ] 結合: /api/chat（出典DB由来・回答不能）、/api/admin/documents（409重複・403権限）
- [ ] 精度評価30問（正答率80%/出典100%/誤回答10%以下）
- [ ] npm audit / セキュリティヘッダ確認

### MVPから外す（Phase 2以降）

- [ ] 原本PDFビューア、回答ストリーミング、MMR等の高度な多様性制御
- [ ] 監査ログ/利用分析、同名PDF自動差分更新、マルチターン会話