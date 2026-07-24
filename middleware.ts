/**
 * ルート保護ミドルウェア (要件11)。
 *
 * - 未認証 / 許可ドメイン外 → /login へリダイレクト
 * - 認証済みで /login → /chat へ
 * - /admin/* は管理者(app_metadata.role=admin)のみ
 *
 * ※これは多層防御の1層。各 API / ページ側でも requireUser / requireAdmin で確認する。
 */
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { parseAllowedDomains } from "@/lib/auth/email-domain";
import { isAdminUser, isAllowedUser } from "@/lib/auth/user";

/** Supabase が設定したセッションCookieを、リダイレクト応答へ引き継ぐ。 */
function withCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const allowedDomains = parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS);
  const authed = isAllowedUser(user, allowedDomains);

  // 認証不要な公開パス
  const isPublicPath =
    pathname === "/login" || pathname.startsWith("/auth");

  if (!authed) {
    if (isPublicPath) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return withCookies(response, NextResponse.redirect(url));
  }

  // 認証済みがログイン画面に来たらチャットへ
  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    url.search = "";
    return withCookies(response, NextResponse.redirect(url));
  }

  // 管理者専用エリア
  if (pathname.startsWith("/admin") && !isAdminUser(user)) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    url.search = "";
    return withCookies(response, NextResponse.redirect(url));
  }

  return response;
}

export const config = {
  // 静的アセットと画像最適化は除外
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
