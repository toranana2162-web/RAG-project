import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" は import 時に例外を投げるためテストでは空モジュールへ差し替え
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
      // "next/headers" はリクエストスコープ依存のためテストでは最小スタブへ差し替え
      "next/headers": fileURLToPath(new URL("./src/test/next-headers-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
