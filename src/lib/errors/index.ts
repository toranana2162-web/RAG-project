/**
 * 共通エラー型。
 * 内部エラーの詳細をそのままユーザーへ返さないための骨組み (要件12 / CLAUDE.md)。
 */

/** ユーザーへ提示してよいメッセージを持つアプリケーションエラー */
export class AppError extends Error {
  /** HTTPステータス相当 */
  readonly status: number;
  /** 機械可読なエラーコード */
  readonly code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

/** API レスポンス用のエラー整形。内部詳細は含めない。 */
export function toErrorResponse(error: unknown): {
  status: number;
  body: { error: { code: string; message: string } };
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
    };
  }
  // 想定外エラーは内部詳細を隠して汎用メッセージにする。
  return {
    status: 500,
    body: {
      error: {
        code: "internal_error",
        message: "サーバー内部でエラーが発生しました。",
      },
    },
  };
}
