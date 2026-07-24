/**
 * 精度評価ランナー (要件14)。
 *
 * 使い方: npm run eval scripts/eval/dataset.json
 *
 * アプリの純ロジック（diversity / citations / prompts）を再利用し、
 * 検索・Embedding・Claude はここでオフライン実行する（server-only を通さない）。
 * 本番と同じ設定値（loadRagConfig）・同じ経路（match_chunks / documents）で評価する。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { loadRagConfig } from "../../src/config/rag";
import { applyDiversity, type RetrievedChunk } from "../../src/lib/rag/diversity";
import {
  filterValidChunkIds,
  dedupeCitations,
  type Citation,
} from "../../src/lib/rag/citations";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type PromptChunk,
} from "../../src/lib/ai/prompts";

// --- データ形式 ---
const CaseSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answerable: z.boolean(),
  expectedFile: z.string().optional(),
  expectedPage: z.number().optional(),
  expectedAnswer: z.string().optional(),
  expectedKeywords: z.array(z.string()).optional(),
});
type EvalCase = z.infer<typeof CaseSchema>;

const AnswerSchema = z.object({
  answerable: z.boolean(),
  answer: z.string(),
  citedChunkIds: z.array(z.string()),
});
const JudgeSchema = z.object({ correct: z.boolean(), reason: z.string() });

interface CaseResult {
  id: string;
  question: string;
  answerableExpected: boolean;
  answerableActual: boolean;
  answer: string;
  citations: Citation[];
  retrievalCorrect: boolean | null;
  citationCorrect: boolean | null;
  citationShown: boolean | null;
  answerCorrect: boolean | null;
  misanswered: boolean | null;
  judgeReason?: string;
}

const cfg = (() => {
  loadEnvConfig(process.cwd());
  return loadRagConfig(process.env);
})();

const OPENAI_KEY = process.env.EMBEDDING_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JUDGE_MODEL = process.env.JUDGE_MODEL?.trim() || cfg.answerModel;

function requireEnv() {
  const missing: string[] = [];
  if (!OPENAI_KEY) missing.push("EMBEDDING_API_KEY");
  if (!ANTHROPIC_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SERVICE_ROLE) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    console.error(`環境変数が不足しています: ${missing.join(", ")}`);
    process.exit(1);
  }
}

const anthropic = () => new Anthropic({ apiKey: ANTHROPIC_KEY, maxRetries: 4 });
const supabase = () => createClient(SUPABASE_URL!, SERVICE_ROLE!);

/** 一時的なネットワークエラーに対する指数バックオフ付きリトライ。 */
async function withRetry<T>(fn: () => Promise<T>, retries = 4, baseMs = 1500): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

async function embed(question: string): Promise<number[]> {
  return withRetry(async () => {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({ model: cfg.embeddingModel, input: [question] }),
    });
    if (!res.ok) throw new Error(`Embedding API error ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data[0].embedding;
  });
}

async function retrieve(question: string): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embed(question);
  const { data, error } = await withRetry(
    async () =>
      await supabase().rpc("match_chunks", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: cfg.similarityThreshold,
        match_count: cfg.retrievalTopK * 3,
      }),
  );
  if (error) throw new Error(`match_chunks error: ${error.message}`);
  const rows = (data ?? []) as {
    chunk_id: string;
    document_id: string;
    page_number: number;
    content: string;
    similarity: number;
  }[];
  const mapped: RetrievedChunk[] = rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    pageNumber: r.page_number,
    content: r.content,
    similarity: r.similarity,
  }));
  return applyDiversity(mapped, cfg.maxChunksPerDocument, cfg.retrievalTopK);
}

const ANSWER_FORMAT = {
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

async function generateAnswer(question: string, chunks: PromptChunk[]) {
  const res = await withRetry(() => anthropic().messages.create({
    model: cfg.answerModel,
    max_tokens: 4000,
    thinking: { type: "disabled" },
    system: buildSystemPrompt(),
    output_config: { format: ANSWER_FORMAT },
    messages: [{ role: "user", content: buildUserPrompt(question, chunks) }],
  }));
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!text) throw new Error("no text block in answer");
  return AnswerSchema.parse(JSON.parse(text.text));
}

async function fileNameMap(documentIds: string[]): Promise<Map<string, string>> {
  if (documentIds.length === 0) return new Map();
  const { data } = await withRetry(
    async () =>
      await supabase().from("documents").select("id, file_name").in("id", documentIds),
  );
  return new Map(
    (data ?? []).map((d: { id: string; file_name: string }) => [d.id, d.file_name]),
  );
}

const JUDGE_FORMAT = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      correct: { type: "boolean" },
      reason: { type: "string" },
    },
    required: ["correct", "reason"],
    additionalProperties: false,
  },
};

async function judge(
  question: string,
  generated: string,
  expectedAnswer?: string,
  expectedKeywords?: string[],
): Promise<z.infer<typeof JudgeSchema>> {
  const system =
    "あなたは厳格な採点者です。生成回答が質問に正しく答え、期待回答の要点と矛盾せず、" +
    "文書にない情報を勝手に追加していなければ correct=true としてください。" +
    "期待回答と細部の表現が違っても、意味が一致していれば正解とみなします。" +
    "出力は {correct, reason} のJSONスキーマに従うこと。";
  const user = [
    `【質問】\n${question}`,
    expectedAnswer ? `【期待回答の要点】\n${expectedAnswer}` : "",
    expectedKeywords?.length ? `【期待キーワード】\n${expectedKeywords.join(", ")}` : "",
    `【生成回答】\n${generated}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await withRetry(() => anthropic().messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1000,
    thinking: { type: "disabled" },
    system,
    output_config: { format: JUDGE_FORMAT },
    messages: [{ role: "user", content: user }],
  }));
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!text) throw new Error("no text block in judge");
  return JudgeSchema.parse(JSON.parse(text.text));
}

async function evaluateCase(c: EvalCase): Promise<CaseResult> {
  const chunks = await retrieve(c.question);

  let answerableActual = false;
  let answer = "";
  let citations: Citation[] = [];

  if (chunks.length > 0) {
    const gen = await generateAnswer(
      c.question,
      chunks.map((ch) => ({ chunkId: ch.chunkId, content: ch.content })),
    );
    if (gen.answerable) {
      const valid = filterValidChunkIds(gen.citedChunkIds, chunks);
      const names = await fileNameMap([...new Set(valid.map((v) => v.documentId))]);
      citations = dedupeCitations(valid, names);
      if (citations.length > 0) {
        answerableActual = true;
        answer = gen.answer;
      }
    }
  }

  const base: CaseResult = {
    id: c.id,
    question: c.question,
    answerableExpected: c.answerable,
    answerableActual,
    answer,
    citations,
    retrievalCorrect: null,
    citationCorrect: null,
    citationShown: null,
    answerCorrect: null,
    misanswered: null,
  };

  if (!c.answerable) {
    // 文書に無い問: 回答してしまったら誤回答
    base.misanswered = answerableActual;
    return base;
  }

  // answerable: 検索/出典/正答を判定
  const retrievedNames = await fileNameMap([
    ...new Set(chunks.map((ch) => ch.documentId)),
  ]);
  const matches = (fileName: string | undefined, page: number) =>
    c.expectedFile === fileName &&
    (c.expectedPage === undefined || c.expectedPage === page);

  base.retrievalCorrect = c.expectedFile
    ? chunks.some((ch) => matches(retrievedNames.get(ch.documentId), ch.pageNumber))
    : null;
  base.citationShown = answerableActual;
  base.citationCorrect = c.expectedFile
    ? citations.some((cit) => matches(cit.fileName, cit.pageNumber))
    : null;

  if (answerableActual) {
    const verdict = await judge(c.question, answer, c.expectedAnswer, c.expectedKeywords);
    base.answerCorrect = verdict.correct;
    base.judgeReason = verdict.reason;
  } else {
    // 回答可能な問なのに回答不能を返した = 不正解
    base.answerCorrect = false;
  }
  return base;
}

function pct(n: number, d: number): string {
  return d === 0 ? "N/A" : `${((n / d) * 100).toFixed(1)}%`;
}

async function main() {
  requireEnv();
  const path = process.argv[2] ?? "scripts/eval/dataset.json";
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const cases = z.array(CaseSchema).parse(raw);
  console.log(`評価開始: ${cases.length}問（${path}）\n`);

  const results: CaseResult[] = [];
  const errored: string[] = [];
  for (const c of cases) {
    process.stdout.write(`- ${c.id} ... `);
    try {
      const r = await evaluateCase(c);
      results.push(r);
      console.log("done");
    } catch (e) {
      // リトライしても失敗した問は記録して継続（1問の障害で全体を止めない）
      console.log(`ERROR(skipped): ${(e as Error).message}`);
      errored.push(c.id);
    }
  }
  if (errored.length > 0) {
    console.log(`\n⚠ ネットワーク等で評価できなかった問: ${errored.length} → ${errored.join(", ")}`);
    console.log("（下記の指標はこれらを除いた問で集計。全問測定するには再実行してください）");
  }

  const answerable = results.filter((r) => r.answerableExpected);
  const unanswerable = results.filter((r) => !r.answerableExpected);
  const retrievalScored = answerable.filter((r) => r.retrievalCorrect !== null);
  const citationScored = answerable.filter((r) => r.citationCorrect !== null);

  const correctCount = answerable.filter((r) => r.answerCorrect).length;
  const citationShownCount = answerable.filter((r) => r.citationShown).length;
  const misansweredCount = unanswerable.filter((r) => r.misanswered).length;
  const retrievalCount = retrievalScored.filter((r) => r.retrievalCorrect).length;
  const citationCorrectCount = citationScored.filter((r) => r.citationCorrect).length;

  const accuracy = correctCount / (answerable.length || 1);
  const citationRate = citationShownCount / (answerable.length || 1);
  const misanswerRate = misansweredCount / (unanswerable.length || 1);

  console.log("\n========== 精度評価サマリ ==========");
  console.log(`回答可能な問: ${answerable.length} / 回答不能な問: ${unanswerable.length}`);
  console.log(
    `正答率            : ${pct(correctCount, answerable.length)}  (基準 ≥80%)  ${
      accuracy >= 0.8 ? "✅" : "❌"
    }`,
  );
  console.log(
    `出典表示率        : ${pct(citationShownCount, answerable.length)}  (基準 100%)  ${
      citationRate >= 1 ? "✅" : "❌"
    }`,
  );
  console.log(
    `回答不能誤回答率  : ${pct(misansweredCount, unanswerable.length)}  (基準 ≤10%)  ${
      misanswerRate <= 0.1 ? "✅" : "❌"
    }`,
  );
  console.log("--- 参考 ---");
  console.log(`検索正解率(retrieval): ${pct(retrievalCount, retrievalScored.length)}`);
  console.log(`出典正解率           : ${pct(citationCorrectCount, citationScored.length)}`);

  const pass = accuracy >= 0.8 && citationRate >= 1 && misanswerRate <= 0.1;
  console.log(`\n総合判定: ${pass ? "✅ 合格" : "❌ 未達"}`);

  const outPath = "scripts/eval/results.json";
  writeFileSync(outPath, JSON.stringify({ summary: { accuracy, citationRate, misanswerRate, pass }, results }, null, 2));
  console.log(`\n明細を ${outPath} に出力しました。`);

  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
