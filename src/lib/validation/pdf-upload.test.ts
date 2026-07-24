import { describe, it, expect } from "vitest";
import { assertValidPdf, hasPdfMagic, sha256Hex } from "./pdf-upload";
import { AppError } from "@/lib/errors";

const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // "%PDF-1"
const MAX = 20 * 1024 * 1024;

function validInput(overrides: Partial<Parameters<typeof assertValidPdf>[0]> = {}) {
  return {
    fileName: "doc.pdf",
    mimeType: "application/pdf",
    size: 1000,
    header: PDF_HEADER,
    ...overrides,
  };
}

describe("hasPdfMagic", () => {
  it("%PDF- で始まれば true", () => {
    expect(hasPdfMagic(PDF_HEADER)).toBe(true);
  });
  it("異なる先頭バイトは false", () => {
    expect(hasPdfMagic(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false); // ZIP
    expect(hasPdfMagic(new Uint8Array([0x25]))).toBe(false); // 短すぎ
  });
});

describe("assertValidPdf", () => {
  it("正しいPDFは通る", () => {
    expect(() => assertValidPdf(validInput(), MAX)).not.toThrow();
  });
  it("空ファイルは 422", () => {
    expect(() => assertValidPdf(validInput({ size: 0 }), MAX)).toThrow(AppError);
  });
  it("サイズ超過は 413", () => {
    try {
      assertValidPdf(validInput({ size: MAX + 1 }), MAX);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(413);
    }
  });
  it("拡張子偽装(.exe)は 422", () => {
    expect(() => assertValidPdf(validInput({ fileName: "doc.exe" }), MAX)).toThrow(AppError);
  });
  it("MIME不一致は 422", () => {
    expect(() =>
      assertValidPdf(validInput({ mimeType: "image/png" }), MAX),
    ).toThrow(AppError);
  });
  it("中身がPDFでない(マジックバイト不一致)は 422", () => {
    expect(() =>
      assertValidPdf(validInput({ header: new Uint8Array([0x50, 0x4b, 0x03, 0x04]) }), MAX),
    ).toThrow(AppError);
  });
});

describe("sha256Hex", () => {
  it("同じ内容は同じハッシュ、違う内容は違うハッシュ", () => {
    const a = sha256Hex(new Uint8Array([1, 2, 3]));
    const b = sha256Hex(new Uint8Array([1, 2, 3]));
    const c = sha256Hex(new Uint8Array([1, 2, 4]));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
