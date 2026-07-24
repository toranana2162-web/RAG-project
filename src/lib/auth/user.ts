/**
 * ユーザーの認可判定（純関数・テスト対象）。
 * ミドルウェア（Edge）からも使うため server-only 依存を持たない。
 */
import type { User } from "@supabase/supabase-js";
import { isAllowedEmail } from "./email-domain";

/**
 * 管理者かどうか。
 * ロールは app_metadata.role を参照する。
 * app_metadata は Service Role のみ変更可能で、クライアントからは改変できないため安全。
 * （user_metadata はクライアント改変可のため使用しない）
 */
export function isAdminUser(user: User | null | undefined): boolean {
  const role = (user?.app_metadata as { role?: unknown } | undefined)?.role;
  return role === "admin";
}

/** ログイン可能な（許可ドメインの）ユーザーかどうか。 */
export function isAllowedUser(
  user: User | null | undefined,
  allowedDomains: string[],
): boolean {
  const email = user?.email;
  if (!email) return false;
  return isAllowedEmail(email, allowedDomains);
}
