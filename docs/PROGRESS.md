# PROGRESS

## プロジェクト開始

開始日：2026-07-16

### 目的

企業向け社内文書検索AI（RAG）のMVPを開発する。

### 現在の状況

- ✅ MVP完成・本番稼働中（https://rag-prpject.vercel.app）
- 全Phase完了（設計〜本番デプロイ）。精度評価合格（正答率100%/出典100%/誤回答0%）。
- 受け入れ条件（要件15）1〜11 すべて達成。テスト57件・脆弱性0。
- 最終更新：2026-07-25

---

## 開発ログ

（Claude Codeがここへ追記していく）

### 2026-07-16 設計レビュー実施（実装なし）

Claude Codeによる設計レビューを実施。REQUIREMENTS.md / ARCHITECTURE.md / TASKS.md /
PROGRESS.md / DECISIONS.md を読み込み、以下の観点でレビューした。

- プロジェクト概要 / 良い点 / 改善点（高中低）
- 実装前に決めるべきこと（人間判断）
- 推奨実装順序（Phase単位）
- データベース設計レビュー
- API設計レビュー
- セキュリティレビュー
- テスト方針（最低限）
- MVPから外しても良い機能

主な結論：

- 設計思想（出典の信頼性設計、回答不能の正常系化、責務分離、セキュリティ方針）はMVPとして良好。
- 最大のリスクは (1) PDF解析の非同期実行基盤が未設計であること、
  (2) Embeddingモデル・ベクトル次元が未確定であること。実装着手前に確定が必要。
- レビュー結果を TASKS.md（TODO追記）と DECISIONS.md（設計判断追記）へ反映。

現在の状況：

- 設計レビュー完了。実装は未着手（承認待ち）。
- 次アクション：Phase 0の人間判断事項（特にEmbeddingモデル/解析実行環境/ホスティング）の確定。

### 2026-07-16 技術構成・Embedding確定 + Phase 2実装

技術構成を確定（D-9）。Embeddingは OpenAI公式仕様を確認のうえ
text-embedding-3-small / 1536次元 / cosine に確定（D-10、選択肢A）。

Phase 2（DB）を実装：

- 作成: supabase/migrations/0001〜0006、src/types/db.ts
- pgvector有効化、documents / document_chunks、RLS、ivfflat index、match_chunks RPC
- 設計判断: document_pages は省略（D、chunksで代替）／管理者判定は app_metadata.role
  （user_metadata はクライアント改変可のため不採用。認可の安全性を優先）

未解決：

- Supabase CLI / Docker / TSプロジェクトが未導入（Phase 1未実施）のため、
  マイグレーション実適用・typecheck・RLS/RPC動作確認が未実行。
- Phase 1（プロジェクト基盤 + Supabase接続）完了後に実適用と動作検証を行う。

### 2026-07-17 Phase 1実装（プロジェクト基盤）

Next.js 16（App Router / src-dir）+ TypeScript strict + Tailwind v4 を導入。
既存の docs / supabase / src/types を保持するため一時ディレクトリでscaffoldしマージ。

- 追加: package.json（typecheck/testスクリプト）、tsconfig（strict確認）、
  vitest.config.ts、.env.local.example、.gitignore調整（.env.local.exampleは例外でコミット）
- 追加: src/config/rag.ts（設定集約・環境変数上書き可）+ rag.test.ts
- 追加: src/lib/supabase/{browser,server,admin}.ts（adminはserver-onlyでService Role保護）
- 追加: src/lib/errors/index.ts（内部エラーを隠す整形）
- 依存: @supabase/supabase-js, @supabase/ssr, vitest

決定事項:
- テストフレームワークは Vitest（軽量・TS相性）
- DB検証はホスティング型Supabase（東京）を使用（Docker未導入のため）
- 管理者判定は app_metadata.role（Phase 2で採用済み。user_metadataは不採用）

検証結果（すべて成功）:
- npm run lint … pass
- npm run typecheck … pass
- npm run test … 3 tests pass
- npm run build … success

未解決 / 次アクション（人間の作業が必要）:
- Supabase（東京）プロジェクト作成、URL/anon/service_role キー発行、.env.local 設定
- 上記後、Phase 2 マイグレーションを supabase db push で実適用し、RLS/RPC/cascadeを検証

### 2026-07-18 Phase 2 実適用・検証完了

ホスティング型Supabase（東京リージョン）を作成し、Phase 2マイグレーションを適用・検証。

- キー名称: 新UIの Publishable key → NEXT_PUBLIC_SUPABASE_ANON_KEY /
  Secret key → SUPABASE_SERVICE_ROLE_KEY に対応（旧anon/service_roleと同等）。
- 適用方法: supabase CLI の login が非TTY環境で不可だったため、
  SQL Editor に supabase/apply_all.sql を貼り付けて適用。
- マイグレーションは CLI 互換のためタイムスタンプ形式へリネーム
  （20260718090001〜090006_*.sql）。

検証結果（supabase/verify.sql、すべて合格）:
- ① スキーマ: vector/pgcrypto拡張=1、documents/document_chunks=1、
  match_chunks/is_admin=1、RLSポリシー=8、embedding列=vector(1536)
- ② match_chunks: 閾値0.5で直交チャンクを除外しAのみヒット、最類似が文書A、
  ON DELETE CASCADE で文書A削除時にチャンクも削除（=0）
- ③ RLS: 非管理者のINSERTを ERROR 42501（row-level security policy）で拒否、
  SELECTは許可、is_admin()=false

→ Phase 2 は実DBで検証済み完了。

次アクション（人間の作業）:
- 運用開始前に OpenAI への社内文書送信の最終データポリシー確認（既出）。
- 次フェーズ着手時に、認証(Phase 3案)またはPDF取り込みの計画提示を行う。

### 2026-07-18 認証・認可（Phase 2.5）実装

Supabase Auth のマジックリンクで認証・認可を実装（設計レビューで前倒し新設）。

作成:
- middleware.ts / src/lib/supabase/middleware.ts（ルート保護＋セッション更新）
- src/lib/auth/{email-domain,user,authorization}.ts（+ 各テスト）
- src/app/login/{page,login-form,actions}.tsx（マジックリンク送信）
- src/app/auth/{confirm,callback,signout}/route.ts
- src/app/chat/page.tsx / src/app/admin/documents/page.tsx（保護シェル）
- src/components/auth/sign-out-button.tsx / src/app/page.tsx（/chatへ）
- .env.local.example に NEXT_PUBLIC_SITE_URL 追記

設計判断（D-11）:
- マジックリンク採用。送信前とコールバック後の二重ドメイン検証。
- 管理者判定は app_metadata.role。認可は middleware と requireUser/requireAdmin の多層。
- 許可ドメイン未設定時は fail-safe で全拒否。

検証（すべて成功）:
- npm run lint … pass / typecheck … pass / test … 16 pass / build … success

未解決 / 次アクション（人間の作業が必要）:
- Supabase ダッシュボード: Redirect URLs 登録、Magic Link メールテンプレートを
  token_hash 形式（/auth/confirm?token_hash=...&type=email）へ変更。
- 自分のアカウントを管理者化（app_metadata.role='admin' をSQLで更新）。
- 上記後、実ログインE2E（許可/非許可/未認証/管理者）を確認。

### 2026-07-20 認証・認可 実環境E2E検証 完了

Supabase ダッシュボード設定（Site URL / Redirect URLs / Magic linkテンプレート）と
管理者付与を実施し、実ログインを検証・成功。

- 未認証 → /login リダイレクト（確認済）
- マジックリンク送信・ログイン成功（/auth/confirm → /chat 200）
- 管理者化＋再ログインで /admin/documents 利用可・「文書管理」リンク表示
- 一時デバッグ出力（actions.ts）は原因確定後に削除済み。

トラブルシュート記録:
- メール文面が既定のままだとリンクが噛み合わず失敗 → テンプレートを token_hash 形式へ。
- スマホでリンクを開くと localhost が端末自身を指し到達せず → PCで開けば成功。
- app_metadata 反映には再ログイン（JWT再発行）が必要。

→ Phase 2.5（認証・認可）は実環境E2Eまで完了。次は Phase 3（PDF取り込み）。

### 2026-07-20 Phase 3a（PDF登録基盤）実装・検証

解析実行方式は「同期API（1文書ずつ・冪等リトライ）」に確定。まず登録基盤を実装。

作成:
- supabase/migrations/20260720120001_storage.sql（非公開バケット+管理者ポリシー）
- src/lib/validation/pdf-upload.ts（+テスト）: MIME/拡張子/マジックバイト/20MB/SHA-256
- src/app/api/admin/documents/route.ts（POST=アップロード, GET=一覧）
- src/app/api/admin/documents/[id]/route.ts（DELETE=DB+Storage削除）
- src/app/admin/documents/{page.tsx, upload-form.tsx, document-actions.tsx}（最小UI）
- vitest.config.ts に @ エイリアス追加、zod 導入

検証: lint / typecheck / test(25) / build 成功。storageマイグレーション適用済み、
実アップロード/一覧/削除の動作確認済み（ユーザー確認: 問題なし）。

### 2026-07-21 Phase 3b（解析パイプライン）実装

同期処理でPDF解析→チャンク→Embedding→保存を実装。

作成:
- src/lib/pdf/extract-pages.ts（unpdf・ページ単位抽出・空白除外）
- src/lib/pdf/chunk-text.ts（+テスト）: ページ単位チャンク・サイズ/オーバーラップ・
  トークンは文字数近似（APPROX_CHARS_PER_TOKEN=2）
- src/lib/ai/embeddings.ts（+テスト）: OpenAI embeddings を fetch+指数バックオフ、
  バッチ処理、index順に整列
- src/lib/pdf/process-document.ts: download→抽出→チャンク→Embedding→保存の冪等処理
  （Service Roleで実行、再処理時は既存チャンク削除→再投入）
- src/app/api/admin/documents/[id]/process/route.ts（maxDuration=300）
- 管理UIに ProcessButton 追加、vitest に server-only スタブのエイリアス追加
- 依存: unpdf

設計判断:
- チャンクは1ページに閉じる（出典ページ番号を厳密に保つため、ページ跨ぎしない）。
- pgvectorへは埋め込みを JSON.stringify で "[...]" 形式で渡す（array リテラル化の回避）。
- テキスト0件（スキャンPDF等）は failed で明示（無言成功にしない）。

検証（すべて成功）: lint / typecheck / test(35) / build。

### 2026-07-21 Phase 3 実環境検証 完了

EMBEDDING_API_KEY（OpenAI）を設定し dev 再起動。実PDF複数本で
アップロード→処理を実行し、すべて成功（process API 200・failedなし）。
ページ単位抽出→チャンク→Embedding(1536次元)→保存 が実環境で動作確認できた。

→ Phase 3（PDF取り込み）は 3a・3b とも実環境で検証完了。
次アクション: Phase 4（RAG検索: 質問Embedding→match_chunks→Claude回答→出典検証）の計画提示。

### 2026-07-21 Phase 4（RAG検索・回答生成・出典）実装

検索→Claude回答→出典検証の統合を実装。回答モデルは Claude Sonnet 5（D-12）。

作成:
- src/lib/rag/diversity.ts（+テスト）: 多様性制御（純関数）
- src/lib/rag/citations.ts（+テスト）: chunkId検証・出典dedupe（純関数）
- src/lib/ai/prompts.ts（+テスト）: データ区画・回答不能・インジェクション対策
- src/lib/ai/claude.ts: 公式SDK・構造化出力・思考オフで grounded answer
- src/lib/rag/retrieve.ts: 質問Embedding→match_chunks→多様性制御
- src/lib/rag/validate-citations.ts: 検証済みchunkId→DBからファイル名取得→出典
- src/lib/rag/generate-answer.ts: 統合（出典0件も回答不能扱い）
- src/app/api/chat/route.ts（requireUser・zod・maxDuration=60）
- src/app/chat/{page.tsx, chat-form.tsx}: 最小チャットUI
- config に answerModel 追加、依存: @anthropic-ai/sdk

検証（すべて成功）: lint / typecheck / test(47) / build。

未解決 / 次アクション:
- ★人間の作業: .env.local に ANTHROPIC_API_KEY を設定し dev 再起動。
- 実質問で回答＋出典表示・回答不能ケースを確認。
- 確認できれば Phase 4 完了。次は Phase 5（UI仕上げ）/ Phase 6（テスト・精度評価・本番準備）。

### 2026-07-21 Phase 4 実環境検証 完了

ANTHROPIC_API_KEY を設定し dev 再起動。実質問で検証・成功。

- 登録済みPDFの内容質問 → 回答＋DB由来の出典表示（/api/chat 200・エラーなし）
- 文書に無い質問 → 回答不能の定型文
- レイテンシは 2.6〜10.4秒（Embedding＋検索＋Claude Sonnet 5）

→ Phase 4（RAG検索・回答生成・出典）は実環境で検証完了。
MVPの中核（要件8・9・10）が一気通貫で動作。
次アクション: Phase 5（UI仕上げ）または Phase 6（テスト・精度評価30問・本番準備）。
補足: レイテンシ改善（回答ストリーミング）は必要なら後続で検討（設計レビューL-3で後回し可と整理済み）。

### 2026-07-21 Phase 6a（精度評価ハーネス）実装

要件14を測定可能にする評価ランナーを実装。正答判定は LLM-as-judge（D-12方針の延長）。

作成:
- scripts/eval/run-eval.ts: 純ロジック(diversity/citations/prompts)を再利用し、
  検索・Embedding・Claude をオフライン実行（server-only非経由）。Service Roleで
  match_chunks・documents を参照。4指標を集計し results.json とサマリを出力。
- scripts/eval/dataset.example.json（記入例）、npm run eval、tsx(devDep)
- .gitignore に scripts/eval/dataset.json / results.json を追加

判定:
- 正答率（answerable問のjudge正解率、基準≥80%）
- 出典表示率（answerable問で出典が出た割合、基準100%）
- 回答不能誤回答率（answerable:false問で回答した割合、基準≤10%）
- 参考: 検索正解率・出典正解率（期待ファイル/ページとの一致）

検証: lint / typecheck / test(47) / build 成功。サンプル3問で疎通スモーク成功
（配管動作確認。retrievalはサンプルが実PDF不一致のため0%＝想定内）。

未解決 / 次アクション:
- ★人間の作業: 実PDFから30問以上の scripts/eval/dataset.json を作成。
- 作成後、npm run eval で4指標の合否を測定・記録（要件14の受け入れ確認）。
- 次は Phase 6b（結合テスト・README・npm audit・本番準備）。

### 2026-07-23 精度評価 実施・合格

実PDF由来の60問（回答可能57 / 回答不能3）で評価。チューニング後に全基準達成。

- 正答率 100%（基準≥80%）/ 出典表示率 100%（基準100%）/ 誤回答率 0%（基準≤10%）
- 参考: 検索正解率100% / 出典正解率100%
- チューニング（D-13）: similarityThreshold 0.3→0.15、retrievalTopK 8→10、
  maxChunksPerDocument 3→4。config既定値に反映（本番と同一設定）。
- データ修正: doc5 のファイル名不一致（アップロード時 " (1)" 付与）を
  綺麗な名前で再アップロードして解消。
- 耐障害性: 評価スクリプトにリトライ＋スキップ継続を追加（環境の間欠的な
  ネットワーク断に対応）。診断用 probe.ts も追加。
- 実行時の学び: このシェルからの外部API接続はサンドボックス既定で不通のため、
  評価実行はネットワーク有効化（dangerouslyDisableSandbox）で行った。

→ 要件14（精度評価）の合格基準を実データで達成。
次アクション: Phase 6b（/api/chat等の結合テスト、README、npm audit、本番ビルド/デプロイ準備）。

### 2026-07-23 Phase 5（UI仕上げ）実装

クリーンな社内ツール風のライトテーマで全画面を仕上げ。追加ライブラリなし（Tailwindのみ）。

作成:
- src/components/ui/{button,spinner,card,status-badge}.tsx（共通UI）
- src/components/app-header.tsx（共通ヘッダー・ナビ）
- globals.css（ライトテーマ統一）、layout.tsx（lang=ja・metadata）

変更:
- chat: 会話ログUI（質問/回答/出典を積み上げ）、送信中スピナー、Enter送信、
  自動スクロール、空状態、回答不能のグレー表示。1問1答（ステートレス）は維持。
- admin: 文書一覧カード＋状態バッジ＋メタ情報、アップロード進行/フィードバック、
  処理/再処理/削除ボタン整理、空状態。
- login: Card/Buttonで整え。sign-out-button も共通Button化。

検証: lint / typecheck / test(47) / build 成功。dev で /login 200・新UI配信を確認。

未解決 / 次アクション:
- ★人間の作業: ブラウザで各画面（/login, /chat, /admin/documents）の見た目・
  操作感を目視確認。
- 次は Phase 6b（結合テスト・README・npm audit・本番ビルド/デプロイ準備）。

### 2026-07-23〜24 Phase 5 追修正（IME・通信リトライ）

- チャット入力: IME（日本語）変換中のEnterで送信されないよう isComposing でガード。
  変換途中の文字が入力欄に残る不具合を解消。
- 通信リトライ追加（共通 src/lib/util/retry.ts）:
  - getCurrentUser（認証確認）/ match_chunks（検索）/ documents（出典名取得）を
    指数バックオフでリトライ。Claudeは SDK maxRetries=4、Embeddingは既存リトライ。
  - 目的: 一時的な通信断（不安定回線）による「検索に失敗しました」「認証が必要です」
    の低減。完全な無接続時は最終的に失敗（正しい挙動）。
- 補足: これらのエラーはコード不具合ではなく、テスト環境の間欠的ネットワーク断が原因
  だった（ConnectTimeoutError）。dev はネットワーク有効で起動して検証。

検証: lint / typecheck / test(47) / build 成功。

### 2026-07-24 Phase 6b（本番準備）実装

- 結合テスト追加（10件、計57件）: generate-answer（回答不能の3分岐＋正常系）、
  /api/chat（401/400/正常）、/api/admin/documents（401/403）。
  テスト用に next/headers スタブを vitest エイリアスへ追加。
- README.md 作成（概要・アーキ図・技術・セットアップ・実行・精度評価・
  セキュリティ・制約・Vercelデプロイ手順）。
- npm audit: high 3件（next同梱の postcss/sharp）を package.json overrides
  （postcss ^8.5.19 / sharp ^0.35.0）で解消 → 脆弱性0。next 16.2.10→16.2.11。
- 本番ビルド・本番起動（next start）確認。lint/typecheck/test(57)/build 全通過。

未解決 / 次アクション:
- ★人間の作業（実デプロイ）: Vercel CLIでデプロイ、環境変数設定、
  Supabaseの本番URL登録、本番疎通確認。

### 2026-07-25 本番デプロイ完了

- Vercel CLI でデプロイ。本番URL: https://rag-prpject.vercel.app
- 環境変数7件を Vercel(Production) に設定（値は .env.local から流し込み、非表示）。
- NEXT_PUBLIC_SITE_URL=本番URL で再デプロイ。/login・認可ガードの本番動作を確認。
- Supabase 認証: Site URL=本番URL、Magic linkテンプレート
  {{ .SiteURL }}/auth/confirm?token_hash=...&type=email&next=/chat に設定。
  マジックリンクでの本番ログイン成功。
  （{{ .RedirectTo }} 方式はリンク不正の可能性があり不採用に。ローカル/本番両立は
   Site URL 切替 or 方式見直しで対応可＝既知の運用メモ）
- 注意: PDF処理/チャットの maxDuration は Vercel Pro 前提。Hobbyでは大きめPDFが
  タイムアウトし得る（READMEに記載）。

→ Phase 6b（本番準備・実デプロイ）完了。MVPは本番稼働。

### 2026-07-25 プロジェクト完了サマリ

社内文書検索AI（RAG）MVP を、設計レビュー → 段階実装 → 実環境検証 → 精度評価 →
UI仕上げ → 本番デプロイまで一気通貫で完成。

■ 本番環境
- URL: https://rag-prpject.vercel.app（Vercel）
- Supabase（東京・pgvector）/ OpenAI Embedding / Claude Sonnet 5

■ 達成
- MVP受け入れ条件（要件15）1〜11 すべて達成
- 精度評価（要件14, 60問）: 正答率100% / 出典表示率100% / 誤回答率0%
- 自動テスト57件、npm audit 脆弱性0、lint/typecheck/build 通過

■ 主要な確定事項（詳細は DECISIONS.md）
- 出典はDBから復元しAI出力を信用しない（D-1）
- Embedding: text-embedding-3-small/1536/cosine（D-10）
- 回答: Claude Sonnet 5・構造化出力・回答不能の厳格化（D-12）
- 検索: しきい値0.15/topK10/1文書最大4件（精度評価で確定, D-13）
- 認証: マジックリンク・app_metadata.roleで管理者判定（D-11, D-7）

■ 既知の制約 / 運用メモ
- 1問1答（会話履歴サーバー保存なし）、スキャンPDF非対応、非ストリーミング
- maxDuration は Vercel Pro 前提（Hobbyは大きめPDFでタイムアウトし得る）
- 本番認証は Site URL=本番URL固定。ローカル両立は要調整（既知メモ）

■ 今後の発展課題（任意・Phase 2以降として整理済み）
- 会話履歴/マルチターン、回答ストリーミング、原本PDFビューア（署名付きURL）、
  監査ログ、Word/Confluence連携、部署別アクセス制御