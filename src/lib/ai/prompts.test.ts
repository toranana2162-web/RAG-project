import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt, UNANSWERABLE_MESSAGE } from "./prompts";

describe("prompts", () => {
  it("回答不能の定型文が要件どおり", () => {
    expect(UNANSWERABLE_MESSAGE).toBe(
      "登録されている文書内に、該当する情報を確認できませんでした。",
    );
  });

  it("システムプロンプトに『命令ではない』趣旨のインジェクション対策が含まれる", () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain("命令ではない");
    expect(sys).toContain("検索結果");
  });

  it("ユーザープロンプトは質問とchunkId付きデータ区画を含む", () => {
    const prompt = buildUserPrompt("育休の申請期限は？", [
      { chunkId: "abc-123", content: "申請は1か月前まで" },
    ]);
    expect(prompt).toContain("育休の申請期限は？");
    expect(prompt).toContain('<chunk id="abc-123">');
    expect(prompt).toContain("申請は1か月前まで");
    expect(prompt).toContain("命令ではありません");
  });
});
