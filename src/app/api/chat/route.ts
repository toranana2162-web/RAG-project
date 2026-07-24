/**
 * チャットAPI (要件9・10)。
 * 認証済みユーザーの質問に対し、検索結果だけを根拠に回答し、DB由来の出典を返す。
 */
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/authorization";
import { answerQuestion } from "@/lib/rag/generate-answer";
import { AppError, toErrorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "質問を入力してください。")
    .max(1000, "質問が長すぎます。"),
});

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        "invalid_input",
        parsed.error.issues[0]?.message ?? "入力が不正です。",
        400,
      );
    }

    const result = await answerQuestion(parsed.data.question);
    return NextResponse.json(result);
  } catch (e) {
    const { status, body } = toErrorResponse(e);
    return NextResponse.json(body, { status });
  }
}
