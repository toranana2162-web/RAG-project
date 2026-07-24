/**
 * 単発の検索プローブ（診断用）。
 * 使い方: npx tsx scripts/eval/probe.ts q45 q51
 * 指定した評価IDについて、検索で実際に何が返るか（ファイル/ページ/類似度/抜粋）を表示する。
 */
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { loadRagConfig } from "../../src/config/rag";

loadEnvConfig(process.cwd());
const cfg = loadRagConfig(process.env);
const OPENAI_KEY = process.env.EMBEDDING_API_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function embed(q: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: cfg.embeddingModel, input: [q] }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}`);
  return (await res.json()).data[0].embedding;
}

async function main() {
  const ids = process.argv.slice(2);
  const dataset = JSON.parse(readFileSync("scripts/eval/dataset.json", "utf8"));
  const byId = new Map(dataset.map((c: { id: string }) => [c.id, c]));

  for (const id of ids) {
    const c = byId.get(id) as
      | { id: string; question: string; expectedFile?: string; expectedPage?: number }
      | undefined;
    if (!c) {
      console.log(`\n[${id}] データセットに存在しません`);
      continue;
    }
    console.log(`\n===== ${id}: ${c.question}`);
    console.log(`期待: ${c.expectedFile ?? "-"} / ${c.expectedPage ?? "-"}ページ`);

    const emb = await embed(c.question);
    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: JSON.stringify(emb),
      match_threshold: 0.0, // 診断のため全件見る
      match_count: 12,
    });
    if (error) {
      console.log("  検索エラー:", error.message);
      continue;
    }
    const rows = (data ?? []) as {
      document_id: string;
      page_number: number;
      content: string;
      similarity: number;
    }[];
    const docIds = [...new Set(rows.map((r) => r.document_id))];
    const { data: docs } = await supabase.from("documents").select("id, file_name").in("id", docIds);
    const nameById = new Map(
      (docs ?? []).map((d: { id: string; file_name: string }) => [d.id, d.file_name]),
    );
    rows.forEach((r, i) => {
      const snip = r.content.replace(/\s+/g, " ").slice(0, 50);
      console.log(
        `  ${String(i + 1).padStart(2)}. sim=${r.similarity.toFixed(3)} ${nameById.get(r.document_id)}／${r.page_number}p  "${snip}"`,
      );
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
