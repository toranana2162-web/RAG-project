import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import { isAdminUser, isAllowedUser } from "./user";

function makeUser(partial: Partial<User>): User {
  return {
    id: "u1",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  } as User;
}

describe("isAdminUser", () => {
  it("app_metadata.role が admin なら true", () => {
    expect(isAdminUser(makeUser({ app_metadata: { role: "admin" } }))).toBe(true);
  });
  it("role が admin 以外 / 未設定なら false", () => {
    expect(isAdminUser(makeUser({ app_metadata: { role: "member" } }))).toBe(false);
    expect(isAdminUser(makeUser({ app_metadata: {} }))).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });
  it("user_metadata の role は無視する（改変可のため）", () => {
    expect(
      isAdminUser(makeUser({ app_metadata: {}, user_metadata: { role: "admin" } })),
    ).toBe(false);
  });
});

describe("isAllowedUser", () => {
  const allowed = ["example.co.jp"];
  it("許可ドメインのメールなら true", () => {
    expect(isAllowedUser(makeUser({ email: "u@example.co.jp" }), allowed)).toBe(true);
  });
  it("非許可 / メールなし / null は false", () => {
    expect(isAllowedUser(makeUser({ email: "u@evil.com" }), allowed)).toBe(false);
    expect(isAllowedUser(makeUser({ email: undefined }), allowed)).toBe(false);
    expect(isAllowedUser(null, allowed)).toBe(false);
  });
});
