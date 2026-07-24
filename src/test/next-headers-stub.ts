// Vitest 用スタブ。実行時は Next のリクエストスコープで解決されるが、
// テストでは server 系モジュールを import できるように最小実装へ差し替える
// （vitest.config.ts でエイリアス）。
export async function cookies() {
  return {
    getAll: () => [] as { name: string; value: string }[],
    set: () => {},
    get: () => undefined,
  };
}
