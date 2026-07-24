/**
 * Claude 回答生成 (D-12)。公式 SDK を使用。
 *
 * 構造化出力(json_schema)で { answerable, answer, citedChunkIds } を強制取得する。
 * コスト・レイテンシ最適化のため思考はオフ。検索結果だけを根拠に回答させる (要件9)。
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ragConfig } from "@/config/rag";
import { AppError } from "@/lib/errors";
import { buildSystemPrompt, buildUserPrompt, type PromptChunk } from "./prompts";

const AnswerSchema = z.object({
  answerable: z.boolean(),
  answer: z.string(),
  citedChunkIds: z.array(z.string()),
});

export type GroundedAnswer = z.infer<typeof AnswerSchema>;

// 構造化出力用のJSONスキーマ（output_config.format）
const OUTPUT_FORMAT = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      answerable: { type: "boolean" },
      answer: { type: "string" },
      citedChunkIds: { type: "array", items: { type: "string" } },
    },
    required: ["answerable", "answer", "citedChunkIds"],
    additionalProperties: false,
  },
};

export async function generateGroundedAnswer(
  question: string,
  chunks: PromptChunk[],
): Promise<GroundedAnswer> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError("config_error", "ANTHROPIC_API_KEY が未設定です。", 500);
  }

  // SDKが429/5xx/接続エラーを自動リトライ（通信断への耐性）。
  const client = new Anthropic({ apiKey, maxRetries: 4 });

  const response = await client.messages.create({
    model: ragConfig.answerModel,
    max_tokens: 4000,
    thinking: { type: "disabled" },
    system: buildSystemPrompt(),
    output_config: { format: OUTPUT_FORMAT },
    messages: [{ role: "user", content: buildUserPrompt(question, chunks) }],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!textBlock) {
    throw new AppError("answer_failed", "回答の生成に失敗しました。", 502);
  }

  try {
    return AnswerSchema.parse(JSON.parse(textBlock.text));
  } catch {
    throw new AppError("answer_failed", "回答の解析に失敗しました。", 502);
  }
}
