"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseAllowedDomains, isAllowedEmail } from "@/lib/auth/email-domain";

export interface LoginActionState {
  ok: boolean;
  message: string;
}

/** マジックリンク（OTP）送信。送信前に許可ドメインを検証する (要件11)。 */
export async function sendMagicLink(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { ok: false, message: "メールアドレスを入力してください。" };
  }

  const allowed = parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS);
  if (!isAllowedEmail(email, allowed)) {
    // 非許可ドメインにはリンクを送らない。
    return {
      ok: false,
      message: "このメールアドレスは利用できません。許可された社内ドメインのアドレスを入力してください。",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return { ok: false, message: "サーバー設定エラーです。管理者へ連絡してください。" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/chat`,
      // 既存ユーザーのみログイン可（新規ユーザーの自動作成は許可ドメイン検証済みなので許容）
    },
  });

  if (error) {
    // 内部エラー詳細はユーザーへ出さない (CLAUDE.md)。
    return {
      ok: false,
      message: "送信に失敗しました。しばらくしてから再度お試しください。",
    };
  }

  return {
    ok: true,
    message: "ログイン用リンクをメールに送信しました。メールをご確認ください。",
  };
}
