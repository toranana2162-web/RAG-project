/**
 * マジックリンク（メールOTP）の確認エンドポイント。
 * メールテンプレートの {{ .TokenHash }} リンクからここへ来る。
 *
 * verifyOtp でセッションを確立し、ドメインを再検証する (要件11)。
 */
import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseAllowedDomains, isAllowedEmail } from "@/lib/auth/email-domain";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/chat";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      // セッション確立後、必ずドメインを再検証する。
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const allowed = parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS);

      if (user?.email && isAllowedEmail(user.email, allowed)) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // 許可ドメイン外は即サインアウト。
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=domain`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
