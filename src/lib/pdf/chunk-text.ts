/**
 * テキストのチャンク分割 (要件7)。
 *
 * - ページ単位で分割し、各チャンクは必ず1ページに属する（出典のページ番号を厳密に保つため）。
 * - サイズ/オーバーラップはトークン目安を文字数へ近似して適用する（レビューM-1の割り切り）。
 * - 段落境界を優先し、可能な限り段落を分断しない。
 */
import type { PageText } from "./extract-pages";

/** 1トークンあたりの近似文字数（日本語を含むため保守的に小さめ）。 */
export const APPROX_CHARS_PER_TOKEN = 2;

export interface Chunk {
  pageNumber: number;
  chunkIndex: number;
  content: string;
  /** 近似トークン数 */
  tokenCount: number;
}

export interface ChunkOptions {
  /** 1チャンクのトークン目安 */
  chunkSizeTokens: number;
  /** オーバーラップのトークン目安 */
  chunkOverlapTokens: number;
}

/** ページ配列全体をチャンク配列へ。chunkIndex は文書内で連番。 */
export function chunkPages(pages: PageText[], opts: ChunkOptions): Chunk[] {
  const targetChars = Math.max(1, opts.chunkSizeTokens * APPROX_CHARS_PER_TOKEN);
  const overlapChars = Math.max(0, opts.chunkOverlapTokens * APPROX_CHARS_PER_TOKEN);

  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pieces = splitText(page.text, targetChars, overlapChars);
    for (const content of pieces) {
      chunks.push({
        pageNumber: page.pageNumber,
        chunkIndex,
        content,
        tokenCount: Math.ceil(content.length / APPROX_CHARS_PER_TOKEN),
      });
      chunkIndex += 1;
    }
  }

  return chunks;
}

/** 1ページ分のテキストを、段落優先でチャンクへ分割する。 */
export function splitText(text: string, targetChars: number, overlapChars: number): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];

  // 段落（空行区切り）へ分割。長すぎる段落は固定長でハード分割。
  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const segments: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= targetChars) {
      segments.push(p);
    } else {
      segments.push(...hardSplit(p, targetChars, overlapChars));
    }
  }

  // セグメントを貪欲にパックし、チャンク間にオーバーラップを付与。
  const chunks: string[] = [];
  let current = "";
  for (const seg of segments) {
    const candidate = current ? `${current}\n\n${seg}` : seg;
    if (current && candidate.length > targetChars) {
      chunks.push(current);
      const overlap = tailChars(current, overlapChars);
      current = overlap ? `${overlap}\n\n${seg}` : seg;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** 長い1段落を固定長ウィンドウ（オーバーラップ付き）で分割。 */
function hardSplit(s: string, size: number, overlap: number): string[] {
  const out: string[] = [];
  const stride = Math.max(1, size - overlap);
  for (let i = 0; i < s.length; i += stride) {
    out.push(s.slice(i, i + size));
    if (i + size >= s.length) break;
  }
  return out;
}

/** 末尾 n 文字を返す（オーバーラップ用）。 */
function tailChars(s: string, n: number): string {
  if (n <= 0) return "";
  return s.slice(-n);
}
