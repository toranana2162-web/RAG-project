/**
 * PDFアップロードの検証 (要件5)。
 *
 * ファイル名だけで形式判定せず、MIMEタイプ・拡張子・先頭バイト(%PDF-)を確認する。
 * SHA-256 で重複登録を防ぐ。
 */
import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";

/** PDF の先頭マジックバイト "%PDF-" */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

export interface PdfValidationInput {
  fileName: string;
  mimeType: string;
  size: number;
  /** 先頭数バイト（マジックバイト確認用） */
  header: Uint8Array;
}

/**
 * PDFとして妥当か検証する。不正なら AppError を投げる。
 * @param maxBytes 上限バイト数（config.maxUploadBytes を渡す）
 */
export function assertValidPdf(input: PdfValidationInput, maxBytes: number): void {
  const { fileName, mimeType, size, header } = input;

  if (size <= 0) {
    throw new AppError("empty_file", "ファイルが空です。", 422);
  }
  if (size > maxBytes) {
    const mb = Math.floor(maxBytes / (1024 * 1024));
    throw new AppError("file_too_large", `ファイルサイズが上限（${mb}MB）を超えています。`, 413);
  }
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new AppError("invalid_extension", "拡張子が .pdf ではありません。", 422);
  }
  // ブラウザによっては application/pdf 以外を送ることもあるため、MIMEは補助的に確認。
  if (mimeType && mimeType !== "application/pdf") {
    throw new AppError("invalid_mime", "PDF形式ではありません。", 422);
  }
  if (!hasPdfMagic(header)) {
    throw new AppError("invalid_content", "ファイルの中身がPDFではありません。", 422);
  }
}

/** 先頭バイトが "%PDF-" か */
export function hasPdfMagic(header: Uint8Array): boolean {
  if (header.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((b, i) => header[i] === b);
}

/** SHA-256 を16進文字列で返す */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
