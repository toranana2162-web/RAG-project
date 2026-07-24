/**
 * サーバー側の認可ヘルパ。
 * Server Component / Route Handler の両方から使う。
 *
 * middleware だけに頼らず、API側でも必ず権限を確認する (要件11 / CLAUDE.md)。
 */
import "server-only";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { withRetry } from "@/lib/util/retry";
import { parseAllowedDomains } from "./email-domain";
import { isAdminUser, isAllowedUser } from "./user";

function allowedDomains(): string[] {
  return parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS);
}

/** 現在のユーザー（Supabaseに問い合わせ）。未ログインなら null。 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  // 通信断による一時的な失敗はリトライ（未ログインは即 null 応答なのでリトライされない）。
  const {
    data: { user },
  } = await withRetry(() => supabase.auth.getUser());
  return user;
}

/** ログイン済みかつ許可ドメインのユーザーのみ返す。それ以外は null（画面のリダイレクト判定用）。 */
export async function getAllowedUser(): Promise<User | null> {
  const user = await getCurrentUser();
  if (user && isAllowedUser(user, allowedDomains())) return user;
  return null;
}

/** API用: 認証+ドメインを必須化。満たさなければ AppError を投げる。 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("unauthorized", "認証が必要です。", 401);
  }
  if (!isAllowedUser(user, allowedDomains())) {
    throw new AppError("forbidden", "利用が許可されていないアカウントです。", 403);
  }
  return user;
}

/** API用: 管理者を必須化。満たさなければ AppError を投げる。 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdminUser(user)) {
    throw new AppError("forbidden", "管理者権限が必要です。", 403);
  }
  return user;
}

export { isAdminUser, isAllowedUser } from "./user";
