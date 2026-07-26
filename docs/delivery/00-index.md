# 納品ドキュメント一覧

社内文書検索AI（RAG）の納品物。内容は実装（`src/`・`supabase/migrations/`）に基づき、
2026-07-26 時点の本番稼働バージョン（https://rag-prpject.vercel.app）に整合。

| # | ドキュメント | 対象読者 | 概要 |
|---|---|---|---|
| 01 | [アーキテクチャ図](./01-architecture.md) | 情報システム部門 | 全体構成・データフロー・ER図・認証・CI/CD（Mermaid） |
| 02 | [運用手順書](./02-operations-manual.md) | クライアント運用担当 | ログイン・質問・文書登録・権限付与・デプロイ運用 |
| 03 | [システム概要資料](./03-system-overview.md) | 全般 | 目的・機能・技術構成・設定値・精度・制約 |
| 04 | [想定トラブルと対処](./04-troubleshooting.md) | 運用/サポート | 症状別の原因と対処、エスカレーション情報 |
| 05 | [Phase2 提案書](./05-phase2-proposal.md) | 意思決定者 | 追加機能・概算工数・期待効果・ロードマップ |

補足資料（リポジトリ内）:
- `README.md` … セットアップ/実行/デプロイ
- `docs/REQUIREMENTS.md` / `ARCHITECTURE.md` … 要件・設計
- `docs/DECISIONS.md` … 設計判断の記録（D-1〜D-13）
- `docs/PROGRESS.md` … 開発ログ（着手〜本番稼働）
