/**
 * 文書の解析処理（同期・1文書ずつ）。処理/再処理の両方に使う。
 * 冪等: 既存チャンクを削除してから再投入するため、再実行しても重複しない。
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import { processDocument } from "@/lib/pdf/process-document";
import { toErrorResponse } from "@/lib/errors";

export const runtime = "nodejs";
// Vercel Pro で最大300秒。大きめPDFのタイムアウトを緩和（ローカルは無制限）。
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await processDocument(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const { status, body } = toErrorResponse(e);
    return NextResponse.json(body, { status });
  }
}
