/**
 * PKCE(code)フロー用コールバック。
 * OAuth や、code を返す認証フローで使用する。マジックリンクは /auth/confirm を使う。
 *
 * exchangeCodeForSession でセッションを確立し、ドメインを再検証する (要件11)。
 */
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseAllowedDomains, isAllowedEmail } from "@/lib/auth/email-domain";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/chat";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const allowed = parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS);

      if (user?.email && isAllowedEmail(user.email, allowed)) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=domain`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
