# 社内文書検索AI（RAG）

社員が自然文で質問すると、社内PDFから関連箇所を検索し、Claude API で回答を生成する社内文書検索システム（MVP）。
回答には必ず**根拠となるファイル名とページ番号**を表示し、文書にない情報は推測させません。

- 回答の出典は AI の出力を信用せず、**サーバー側でDBから取得**（chunkId を検証）。
- 情報が無い質問は「回答不能」を正常結果として扱う。
- 認証は社内メールドメイン限定（マジックリンク）。管理者のみ文書を登録可能。

---

## 技術スタック

| 領域 | 採用 |
|---|---|
| フロント / API | Next.js 16（App Router）/ TypeScript strict / Tailwind CSS v4 |
| 認証 | Supabase Auth（マジックリンク・社内ドメイン限定） |
| データベース | Supabase PostgreSQL + pgvector（東京リージョン） |
| ストレージ | Supabase Storage（非公開バケット） |
| Embedding | OpenAI `text-embedding-3-small`（1536次元 / cosine） |
| 回答生成 | Claude `claude-sonnet-5`（構造化出力） |
| PDF解析 | unpdf（ページ単位抽出） |
| テスト | Vitest |

---

## アーキテクチャ概要

```
[管理者] PDFアップロード
  └─ /api/admin/documents  ──▶ 検証(MIME/拡張子/マジックバイト/20MB) → SHA-256重複チェック
                                → Supabase Storage 保存 → documents(status=uploaded)
  └─ /api/admin/documents/[id]/process
        └─ 抽出(unpdf) → チャンク分割(ページ単位) → Embedding(OpenAI)
           → document_chunks へ保存 → status=completed（冪等・再処理可）

[社員] 質問
  └─ /api/chat ──▶ 質問Embedding → match_chunks(pgvector, しきい値+多様性制御)
                   → 検索結果のみClaudeへ → Claudeは chunkId のみ選択
                   → chunkId をサーバー検証 → 出典(ファイル名/ページ)をDBから復元
                   → 回答＋出典を返す（根拠不足は「回答不能」）
```

主要ディレクトリ:
- `src/lib/ai`（Claude / Embedding / プロンプト）、`src/lib/pdf`（抽出 / チャンク / 解析）、
  `src/lib/rag`（検索 / 出典検証 / 統合）、`src/lib/auth`（認可）、`src/config/rag.ts`（設定集約）
- `supabase/migrations`（スキーマ・RLS・RPC）、`scripts/eval`（精度評価）

---

## セットアップ

### 前提
- Node.js 20+ / npm
- Supabase プロジェクト（東京リージョン推奨）
- OpenAI API キー、Anthropic API キー

### 1. 依存インストール
```bash
npm install
```

### 2. 環境変数
`.env.local.example` をコピーして `.env.local` を作成し、値を設定。
```bash
cp .env.local.example .env.local
```
| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | 認証メールのリダイレクト先（ローカル: `http://localhost:3000`） |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公開値（Publishable key） |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー専用（Secret key）。**公開しない** |
| `EMBEDDING_API_KEY` | OpenAI API キー |
| `ANTHROPIC_API_KEY` | Anthropic API キー |
| `ALLOWED_EMAIL_DOMAINS` | 許可する社内メールドメイン（カンマ区切り） |
| （任意）`ANSWER_MODEL` / `EMBEDDING_MODEL` / `RAG_*` | 既定値の上書き（`src/config/rag.ts` 参照） |

### 3. データベース（Supabase）
`supabase/migrations/` の各SQLを **SQL Editor** で実行（`supabase/apply_all.sql` に本体スキーマを集約）。加えて Storage 用の `20260720120001_storage.sql` を実行。
- pgvector 有効化、`documents` / `document_chunks`、RLS、`match_chunks` RPC、非公開バケット `documents` を作成。

### 4. 認証（Supabase ダッシュボード）
- **Authentication → URL Configuration**：Site URL と Redirect URLs に `.../auth/confirm`（と `.../auth/callback`）を登録。
- **Authentication → Emails → Magic link**：本文リンクを token_hash 形式へ変更。
  ```html
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/chat">ログイン</a>
  ```
- **管理者付与**（SQL Editor、対象メールを指定）:
  ```sql
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
  where email = 'you@example.co.jp';
  ```
  ※ 反映には再ログインが必要。

---

## 実行

```bash
npm run dev        # 開発サーバー（http://localhost:3000）
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest（ユニット/結合 57件）
npm run build      # 本番ビルド
npm run start      # 本番モード起動（build後）
```

使い方:
1. `/login` で社内メールにマジックリンクを送信 → メールのリンクからログイン。
2. 管理者は `/admin/documents` でPDFを登録し「処理」を実行。
3. `/chat` で質問 → 回答＋出典が表示される。

---

## 精度評価（要件14）

実PDFに基づく評価データ `scripts/eval/dataset.json`（`dataset.example.json` を参照）を用意し:
```bash
npm run eval scripts/eval/dataset.json
```
- 集計指標：正答率（LLM-as-judge）/ 出典表示率 / 回答不能誤回答率。
- 直近結果（60問）：**正答率 100% / 出典表示率 100% / 誤回答率 0%（合格）**。
- 診断ツール：`npx tsx scripts/eval/probe.ts <id...>`（検索結果の可視化）。

---

## セキュリティ方針
- APIキー・Service Role Key はサーバー専用（`.env.local` は Git 管理外）。
- RLS 有効化、Storage は非公開、認可は middleware と API（`requireUser`/`requireAdmin`）の多層。
- 出典は DB から復元し AI 出力を信用しない。検索結果はデータ区画として扱い、PDF本文の指示に従わない。
- SQL はパラメータ化 RPC 経由（ユーザー入力を連結しない）。

## 既知の制約（MVP）
- 1問1答（会話履歴のサーバー保存なし）。
- スキャン（画像）PDF は非対応（テキスト抽出0件は failed）。
- 回答生成は非ストリーミング。Word/Confluence 連携・部署別ACLは対象外。

---

## デプロイ（Vercel）
1. リポジトリを Vercel にインポート（または `npx vercel`）。
2. Vercel の Environment Variables に上記 `.env.local` の値を設定（`NEXT_PUBLIC_SITE_URL` は本番URL）。
3. Supabase の URL Configuration / メールテンプレートに**本番URL**を追加。
4. `/api/admin/documents/[id]/process` は長時間処理のため Vercel Pro（`maxDuration=300`）を推奨。
5. デプロイ後、本番URLでログイン〜質問まで疎通確認。
