# 社内文書検索AI（RAG）設計書

## 1. 技術構成

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Storage
- Supabase PostgreSQL
- pgvector
- Claude API
- Embedding API

AIの役割を以下のように分ける。

- Embeddingモデル：関連文書の検索
- Claude API：検索結果をもとに回答生成
- Supabase：文書、ベクトル、ユーザー情報の保存

---

## 2. システムフロー

### 文書登録

1. 管理者がPDFをアップロード
2. API側で認証・管理者権限を確認
3. ファイル形式と容量を確認
4. ファイルハッシュを作成
5. 重複登録を確認
6. Supabase Storageへ保存
7. PDFをページ単位で解析
8. テキストをチャンク分割
9. Embeddingを生成
10. PostgreSQLへ保存
11. 文書の状態をcompletedへ変更

### 質問回答

1. 一般社員が質問を送信
2. API側で認証を確認
3. 質問文のEmbeddingを生成
4. pgvectorで関連チャンクを検索
5. 類似度基準未満の結果を除外
6. 検索結果と質問をClaude APIへ送信
7. Claudeが回答と引用対象チャンクIDを返す
8. サーバー側でチャンクIDを検証
9. データベースから出典情報を取得
10. 回答と出典を画面へ表示

---

## 3. ディレクトリ構成

```text
src/
├── app/
│   ├── login/
│   │   └── page.tsx
│   ├── chat/
│   │   └── page.tsx
│   ├── admin/
│   │   └── documents/
│   │       └── page.tsx
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts
│   │   └── admin/
│   │       └── documents/
│   │           ├── route.ts
│   │           └── [id]/
│   │               └── route.ts
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── chat/
│   ├── documents/
│   └── ui/
│
├── lib/
│   ├── ai/
│   │   ├── claude.ts
│   │   ├── embeddings.ts
│   │   └── prompts.ts
│   ├── pdf/
│   │   ├── extract-pages.ts
│   │   └── chunk-text.ts
│   ├── rag/
│   │   ├── retrieve.ts
│   │   ├── generate-answer.ts
│   │   └── validate-citations.ts
│   ├── auth/
│   │   └── authorization.ts
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── validation/
│   └── errors/
│
├── config/
│   └── rag.ts
│
└── types/

supabase/
└── migrations/

docs/
├── REQUIREMENTS.md
├── ARCHITECTURE.md
└── TASKS.md