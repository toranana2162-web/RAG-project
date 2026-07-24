/**
 * 管理用 Supabase クライアント（Service Role Key）。
 *
 * ★サーバー専用。RLSをバイパスするため、PDF取り込みのEmbedding書き込み等
 *   サーバー側の限定処理でのみ使用する (要件12 / D-2)。
 *
 * "server-only" により、誤ってクライアントバンドルへ取り込むとビルドエラーになる。
 * Service Role Key は絶対にブラウザへ露出させない (CLAUDE.md)。
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
