import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function AppHeader({
  email,
  isAdmin,
  active,
}: {
  email: string;
  isAdmin: boolean;
  active: "chat" | "admin";
}) {
  const linkBase = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
  const activeCls = "bg-gray-900 text-white";
  const idleCls = "text-gray-600 hover:bg-gray-100";

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/chat" className="text-base font-bold text-gray-900">
            社内文書検索AI
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/chat"
              className={`${linkBase} ${active === "chat" ? activeCls : idleCls}`}
            >
              チャット
            </Link>
            {isAdmin && (
              <Link
                href="/admin/documents"
                className={`${linkBase} ${active === "admin" ? activeCls : idleCls}`}
              >
                文書管理
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-gray-500 sm:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
