# アーキテクチャ図（情報システム部門向け）

社内文書検索AI（RAG）の構成・データフロー・データモデルを Mermaid で示す。
本書は実装（`src/`・`supabase/migrations/`）に基づく。

- 本番URL: https://rag-prpject.vercel.app
- 主要コンポーネント: Next.js(Vercel) / Supabase(東京: Auth・PostgreSQL+pgvector・Storage) / OpenAI Embedding / Claude API

---

## 1. システム全体構成

```mermaid
flowchart TB
    subgraph Client["社員/管理者のブラウザ"]
      UI["Next.js App Router UI<br/>(/login, /chat, /admin/documents)"]
    end

    subgraph Vercel["Vercel (Next.js 16)"]
      MW["middleware<br/>認証・認可ガード"]
      APIchat["/api/chat"]
      APIadmin["/api/admin/documents(/[id]/process)"]
      SrvAuth["認可ヘルパ<br/>requireUser / requireAdmin"]
    end

    subgraph Supabase["Supabase (東京リージョン)"]
      Auth["Auth<br/>マジックリンク"]
      DB[("PostgreSQL + pgvector<br/>documents / document_chunks<br/>match_chunks() RPC / RLS")]
      Storage[["Storage<br/>非公開バケット documents"]]
    end

    OpenAI["OpenAI<br/>text-embedding-3-small (1536次元)"]
    Claude["Anthropic Claude<br/>claude-sonnet-5"]

    UI -->|HTTPS| MW
    MW --> APIchat
    MW --> APIadmin
    APIchat --> SrvAuth
    APIadmin --> SrvAuth
    SrvAuth --> Auth

    APIchat -->|質問をベクトル化| OpenAI
    APIchat -->|match_chunks 検索| DB
    APIchat -->|検索結果のみ渡す| Claude

    APIadmin -->|PDF保存/取得| Storage
    APIadmin -->|抽出テキストをベクトル化| OpenAI
    APIadmin -->|チャンク+ベクトル保存| DB
```

---

## 2. 文書取り込みフロー（管理者）

```mermaid
sequenceDiagram
    participant A as 管理者
    participant U as 管理画面
    participant Up as POST /api/admin/documents
    participant Pr as POST /api/admin/documents/[id]/process
    participant S as Supabase Storage
    participant O as OpenAI Embedding
    participant D as PostgreSQL(pgvector)

    A->>U: PDFを選択してアップロード
    U->>Up: multipart/form-data
    Up->>Up: requireAdmin() / 検証(MIME・拡張子・%PDF-・20MB) / SHA-256重複チェック
    Up->>S: PDFを保存(非公開)
    Up->>D: documents 追加 (status=uploaded)
    Up-->>U: 201 (未処理)

    A->>U: 「処理」ボタン
    U->>Pr: 処理要求
    Pr->>D: status=processing
    Pr->>S: PDFダウンロード
    Pr->>Pr: unpdfでページ単位抽出 → チャンク分割(ページ単位)
    Pr->>O: チャンクをEmbedding(バッチ)
    Pr->>D: 既存チャンク削除→document_chunks挿入(冪等)
    Pr->>D: status=completed / page_count / chunk_count
    Pr-->>U: 完了 (失敗時 status=failed + error_message)
```

---

## 3. 質問応答フロー（RAG）

```mermaid
sequenceDiagram
    participant E as 社員
    participant C as チャット画面
    participant API as POST /api/chat
    participant O as OpenAI Embedding
    participant D as match_chunks (pgvector)
    participant L as Claude (Sonnet 5)

    E->>C: 質問を入力
    C->>API: { question }
    API->>API: requireUser() / 入力検証(zod)
    API->>O: 質問をベクトル化
    API->>D: match_chunks(閾値0.15, 上位10) + 1文書最大4件に制御
    alt 検索結果0件
        API-->>C: 回答不能「該当する情報を確認できませんでした」
    else 検索結果あり
        API->>L: 検索結果のみ + 「chunkIdだけ選べ」
        L-->>API: { answerable, answer, citedChunkIds }
        API->>API: chunkId をサーバー検証（存在しないIDは棄却）
        API->>D: 採用chunkのファイル名/ページをDBから取得
        alt 回答不能 or 検証済み出典0件
            API-->>C: 回答不能（定型文）
        else 正常
            API-->>C: 回答 + 出典(ファイル名/ページ・重複排除)
        end
    end
```

> ポイント: 出典は AI の出力を信用せず、**サーバー側で DB から復元**する。検索結果は「データ」として扱い、PDF本文中の指示には従わない（プロンプトインジェクション対策）。

---

## 4. データモデル（ER図）

```mermaid
erDiagram
    documents ||--o{ document_chunks : "1対多 (ON DELETE CASCADE)"

    documents {
        uuid id PK
        text file_name
        text storage_path
        text content_hash "SHA-256 UNIQUE"
        int byte_size "<=20MB"
        int page_count
        int chunk_count
        enum status "uploaded/processing/completed/failed"
        text error_message
        text embedding_model
        int embedding_dim "1536"
        uuid uploaded_by FK "auth.users"
        timestamptz created_at
        timestamptz updated_at
    }

    document_chunks {
        uuid id PK "= chunkId(出典検証対象)"
        uuid document_id FK
        int page_number "出典ページ"
        int chunk_index
        text content
        int token_count
        vector embedding "vector(1536) / cosine"
        text embedding_model
        timestamptz created_at
    }
```

- 検索は SQL 関数 `match_chunks(query_embedding, match_threshold, match_count)`（cosine類似度、`ivfflat` インデックス）。
- RLS 有効。閲覧は認証済み全員、登録/更新/削除は管理者（`is_admin()` = JWT の `app_metadata.role='admin'`）のみ。Storage は非公開・管理者ポリシー。

---

## 5. 認証フロー（マジックリンク）

```mermaid
sequenceDiagram
    participant U as 利用者
    participant App as アプリ(/login)
    participant Sb as Supabase Auth
    participant Cf as /auth/confirm

    U->>App: 社内メールを入力
    App->>App: 許可ドメイン検証(ALLOWED_EMAIL_DOMAINS)
    App->>Sb: signInWithOtp(emailRedirectTo=/auth/confirm)
    Sb-->>U: マジックリンク付きメール
    U->>Cf: メールのリンク(token_hash)をクリック
    Cf->>Sb: verifyOtp(token_hash)
    Cf->>Cf: セッション確立後にドメイン再検証
    Cf-->>U: /chat へ（不許可なら即サインアウト）
```

---

## 6. デプロイ / CI-CD

```mermaid
flowchart LR
    Dev["開発者"] -->|git push main| GH["GitHub<br/>toranana2162-web/RAG-project"]
    GH -->|Git連携で自動デプロイ| V["Vercel<br/>Production"]
    V --> Prod["https://rag-prpject.vercel.app"]
    Dev -.->|手動デプロイも可| V

    subgraph Env["Vercel 環境変数(Production)"]
      E1["NEXT_PUBLIC_SITE_URL"]
      E2["NEXT_PUBLIC_SUPABASE_URL / ANON_KEY"]
      E3["SUPABASE_SERVICE_ROLE_KEY"]
      E4["EMBEDDING_API_KEY / ANTHROPIC_API_KEY"]
      E5["ALLOWED_EMAIL_DOMAINS"]
    end
    V --- Env
```

> 補足: PDF処理 `/api/admin/documents/[id]/process` は `maxDuration=300`、チャット `/api/chat` は `maxDuration=60`。長時間処理の安定運用には Vercel Pro を推奨。
