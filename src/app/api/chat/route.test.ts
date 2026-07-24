import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/authorization", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/rag/generate-answer", () => ({ answerQuestion: vi.fn() }));

import { POST } from "./route";
import { requireUser } from "@/lib/auth/authorization";
import { answerQuestion } from "@/lib/rag/generate-answer";

const mockRequireUser = vi.mocked(requireUser);
const mockAnswer = vi.mocked(answerQuestion);

function post(body: unknown): NextRequest {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

const fakeUser = { id: "u1" } as unknown as User;

beforeEach(() => vi.clearAllMocks());

describe("POST /api/chat", () => {
  it("未認証は401", async () => {
    mockRequireUser.mockRejectedValue(new AppError("unauthorized", "認証が必要です。", 401));
    const res = await POST(post({ question: "q" }));
    expect(res.status).toBe(401);
  });

  it("空の質問は400", async () => {
    mockRequireUser.mockResolvedValue(fakeUser);
    const res = await POST(post({ question: "   " }));
    expect(res.status).toBe(400);
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  it("質問が無い場合は400", async () => {
    mockRequireUser.mockResolvedValue(fakeUser);
    const res = await POST(post({}));
    expect(res.status).toBe(400);
  });

  it("正常系は回答を返す", async () => {
    mockRequireUser.mockResolvedValue(fakeUser);
    mockAnswer.mockResolvedValue({
      answerable: true,
      answer: "回答",
      citations: [{ fileName: "a.pdf", pageNumber: 1 }],
    });
    const res = await POST(post({ question: "育休について" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toBe("回答");
    expect(json.citations).toHaveLength(1);
  });
});
