import { describe, expect, it } from "vitest";
import { generateShareToken, tokensEqual } from "./crypto";
import { hasValidShareToken } from "./share-token";

describe("tokensEqual", () => {
  it("matches identical tokens", () => {
    const token = generateShareToken();
    expect(tokensEqual(token, token)).toBe(true);
  });

  it("rejects different tokens of the same length", () => {
    expect(tokensEqual("aaaa", "aaab")).toBe(false);
  });

  it("rejects length mismatches without throwing", () => {
    expect(tokensEqual("abcd", "abc")).toBe(false);
    expect(tokensEqual("abc", "abcd")).toBe(false);
  });

  it("rejects empty, null and undefined values", () => {
    expect(tokensEqual("abcd", "")).toBe(false);
    expect(tokensEqual("", "")).toBe(true);
    expect(tokensEqual(null, "abcd")).toBe(false);
    expect(tokensEqual("abcd", null)).toBe(false);
    expect(tokensEqual(undefined, undefined)).toBe(false);
  });
});

describe("hasValidShareToken", () => {
  const privateResource = { visibilityMode: "private", shareToken: "tok-1234" };

  it("accepts the stored token on a private resource", () => {
    expect(hasValidShareToken(privateResource, "tok-1234")).toBe(true);
  });

  it.each([
    ["wrong", "tok-9999"],
    ["shorter", "tok"],
    ["longer", "tok-1234-extra"],
    ["empty", ""],
    ["null", null],
    ["undefined", undefined],
  ])("rejects a %s token", (_label, provided) => {
    expect(hasValidShareToken(privateResource, provided)).toBe(false);
  });

  it("rejects every token when none is stored", () => {
    const resource = { visibilityMode: "private", shareToken: null };
    expect(hasValidShareToken(resource, "null")).toBe(false);
    expect(hasValidShareToken(resource, "")).toBe(false);
  });

  it.each(["public", "public_readonly"])(
    "ignores a matching token on %s resources",
    (visibilityMode) => {
      expect(
        hasValidShareToken({ visibilityMode, shareToken: "tok-1234" }, "tok-1234"),
      ).toBe(false);
    },
  );
});
