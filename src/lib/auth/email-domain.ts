/**
 * 許可メールドメイン判定（純関数・テスト対象）。
 *
 * 社内メールドメインのみログイン可能にするための判定ロジック (要件11)。
 * サーバー/ミドルウェア双方から使うため、副作用や server-only 依存を持たない。
 */

/** "a.co.jp, b.co.jp" のような環境変数値を配列へ。小文字化・空要素除去。 */
export function parseAllowedDomains(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
}

/** メールアドレスからドメイン部分を取り出す。不正な形式は null。 */
export function getEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

/**
 * メールが許可ドメインに属するか。
 * 許可ドメインが未設定（空）の場合は fail-safe として誰も許可しない。
 */
export function isAllowedEmail(email: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return false;
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return allowedDomains.includes(domain);
}
