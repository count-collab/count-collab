import { describe, expect, it } from "vitest";
import { counterUrl, slugify } from "./counter";

describe("slugify", () => {
  it("converts a basic title to a slug", () => {
    expect(slugify("My Awesome Counter")).toBe("my-awesome-counter");
  });

  it("strips special characters", () => {
    expect(slugify("Hello World!!!")).toBe("hello-world");
  });

  it("trims leading and trailing spaces", () => {
    expect(slugify("  spaced  out  ")).toBe("spaced-out");
  });

  it("normalizes accented characters", () => {
    expect(slugify("café résumé")).toBe("cafe-resume");
  });

  it("preserves numbers", () => {
    expect(slugify("Counter 42")).toBe("counter-42");
  });

  it("returns empty string when title is all special characters", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("truncates to 80 characters max", () => {
    const longTitle =
      "this is a very long title that keeps going and going and going and going and going until it exceeds eighty characters easily";
    const result = slugify(longTitle);
    expect(result.length).toBeLessThanOrEqual(80);
  });

  it("does not end with a trailing hyphen after truncation", () => {
    const longTitle =
      "this is a very long title that keeps going and going and going and going and going until it exceeds eighty characters easily";
    const result = slugify(longTitle);
    expect(result).not.toMatch(/-$/);
  });
});

describe("counterUrl", () => {
  it("returns a URL with the slugified title", () => {
    expect(counterUrl("abc-123", "My Counter")).toBe("/c/abc-123/my-counter");
  });

  it("returns URL without slug when title is all special characters", () => {
    expect(counterUrl("abc-123", "!!!")).toBe("/c/abc-123");
  });

  it("returns URL without slug for empty title", () => {
    expect(counterUrl("abc-123", "")).toBe("/c/abc-123");
  });

  it("handles accented characters in title", () => {
    expect(counterUrl("id-1", "café latte")).toBe("/c/id-1/cafe-latte");
  });
});
