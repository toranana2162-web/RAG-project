import { describe, it, expect } from "vitest";
import { parseAllowedDomains, getEmailDomain, isAllowedEmail } from "./email-domain";

describe("parseAllowedDomains", () => {
  it("カンマ区切りを配列化し、小文字化・trim・空要素除去する", () => {
    expect(parseAllowedDomains(" Example.co.jp , b.com ,, ")).toEqual([
      "example.co.jp",
      "b.com",
    ]);
  });
  it("未設定は空配列", () => {
    expect(parseAllowedDomains(undefined)).toEqual([]);
    expect(parseAllowedDomains("")).toEqual([]);
  });
});

describe("getEmailDomain", () => {
  it("ドメインを小文字で返す", () => {
    expect(getEmailDomain("Taro@Example.CO.JP")).toBe("example.co.jp");
  });
  it("不正な形式は null", () => {
    expect(getEmailDomain("no-at-mark")).toBeNull();
    expect(getEmailDomain("@example.com")).toBeNull();
    expect(getEmailDomain("user@")).toBeNull();
  });
});

describe("isAllowedEmail", () => {
  const allowed = ["example.co.jp"];
  it("許可ドメインは true", () => {
    expect(isAllowedEmail("user@example.co.jp", allowed)).toBe(true);
    expect(isAllowedEmail("User@Example.CO.JP", allowed)).toBe(true);
  });
  it("非許可ドメインは false", () => {
    expect(isAllowedEmail("user@evil.com", allowed)).toBe(false);
  });
  it("サブドメイン偽装は false（完全一致のみ許可）", () => {
    expect(isAllowedEmail("user@example.co.jp.evil.com", allowed)).toBe(false);
  });
  it("許可ドメイン未設定なら誰も許可しない（fail-safe）", () => {
    expect(isAllowedEmail("user@example.co.jp", [])).toBe(false);
  });
});
