/**
 * ブラウザ（クライアントコンポーネント）用 Supabase クライアント。
 * anon key のみを使用する。Service Role Key は絶対に使わない (CLAUDE.md)。
 */
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です",
    );
  }

  return createBrowserClient(url, anonKey);
}
