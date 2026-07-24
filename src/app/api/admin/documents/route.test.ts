import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: vi.fn() }));

import { GET } from "./route";
import { requireAdmin } from "@/lib/auth/authorization";

const mockRequireAdmin = vi.mocked(requireAdmin);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/admin/documents", () => {
  it("非管理者は403", async () => {
    mockRequireAdmin.mockRejectedValue(
      new AppError("forbidden", "管理者権限が必要です。", 403),
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("未認証は401", async () => {
    mockRequireAdmin.mockRejectedValue(
      new AppError("unauthorized", "認証が必要です。", 401),
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
