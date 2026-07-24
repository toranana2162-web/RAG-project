/**
 * 一時的なネットワークエラー等に対する指数バックオフ付きリトライ。
 * fn が例外を投げた場合にリトライする。最終的に失敗したら最後の例外を投げる。
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseMs = 400,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}
