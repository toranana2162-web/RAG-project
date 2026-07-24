/**
 * PDFからページ単位でテキストを抽出する (要件6)。
 * ページ番号を保持し、空白ページは除外する。
 *
 * unpdf（pdfjsベース・サーバーレス対応）を使用。OCRは行わない（対象外）。
 */
import { extractText, getDocumentProxy } from "unpdf";

export interface PageText {
  /** 1始まりのページ番号 */
  pageNumber: number;
  text: string;
}

export interface ExtractResult {
  /** PDFの総ページ数 */
  totalPages: number;
  /** テキストのある（空白でない）ページのみ */
  pages: PageText[];
}

export async function extractPages(data: Uint8Array): Promise<ExtractResult> {
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  // text はページごとの文字列配列（mergePages: false）
  const pages: PageText[] = [];
  text.forEach((raw, index) => {
    const cleaned = (raw ?? "").trim();
    if (cleaned.length > 0) {
      pages.push({ pageNumber: index + 1, text: cleaned });
    }
  });

  return { totalPages, pages };
}
