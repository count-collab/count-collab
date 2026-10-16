import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

const FALLBACK = "/home";

describe("safeRedirectPath", () => {
  it.each(["/", "/t/abc", "/t/abc/join", "/my/teams#section"])(
    "accepts %s",
    (path) => {
      expect(safeRedirectPath(path, FALLBACK)).toBe(path);
    },
  );

  it("preserves query strings", () => {
    expect(safeRedirectPath("/t/abc/join?token=xyz&a=1", FALLBACK)).toBe(
      "/t/abc/join?token=xyz&a=1",
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with path", "//evil.com/t/abc"],
    ["absolute https", "https://evil.com"],
    ["absolute http", "http://evil.com/path"],
    ["backslash after slash", "/\\evil.com"],
    ["embedded backslash", "/t\\..\\evil"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,hi"],
    ["relative without slash", "home"],
    ["tab-smuggled protocol-relative", "/\t/evil.com"],
    ["newline", "/home\nSet-Cookie: x"],
    ["DEL character", "/home\u007f"],
  ])("rejects %s", (_label, value) => {
    expect(safeRedirectPath(value, FALLBACK)).toBe(FALLBACK);
  });
});
