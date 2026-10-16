import { describe, expect, it } from "vitest";
import { REDACTED, redactSearch, redactUrl, sanitizeCaptureResult } from "./redact";

describe("redactUrl", () => {
  it("redacts token, code and state values in query strings", () => {
    expect(redactUrl("?token=abc&code=def&state=ghi&q=ok")).toBe(
      `?token=${REDACTED}&code=${REDACTED}&state=${REDACTED}&q=ok`,
    );
  });

  it("redacts inside full URLs and fragments", () => {
    expect(redactUrl("https://x.test/t/1/join?a=1&token=abc#code=zzz")).toBe(
      `https://x.test/t/1/join?a=1&token=${REDACTED}#code=${REDACTED}`,
    );
  });

  it("redacts token-like parameter names case-insensitively", () => {
    expect(redactUrl("?shareToken=a&join_token=b&Token=c")).toBe(
      `?shareToken=${REDACTED}&join_token=${REDACTED}&Token=${REDACTED}`,
    );
  });

  it("does not touch lookalike names or plain text", () => {
    expect(redactUrl("?barcode=1&statement=2")).toBe("?barcode=1&statement=2");
    expect(redactUrl("no query here")).toBe("no query here");
  });
});

describe("redactSearch", () => {
  it("returns undefined for empty search", () => {
    expect(redactSearch("")).toBeUndefined();
    expect(redactSearch("?token=a")).toBe(`?token=${REDACTED}`);
  });
});

describe("sanitizeCaptureResult (PostHog before_send)", () => {
  it("strips tokens from URL and referrer properties", () => {
    const event = {
      event: "$pageview",
      properties: {
        $current_url: "https://x.test/c/1?token=secret&a=1",
        $referrer: "https://x.test/t/1/join?token=secret",
        $initial_referrer: "https://x.test/?token=secret",
        $initial_current_url: "https://x.test/?token=secret",
        $pathname: "/c/1",
        $referring_domain: "x.test",
        $browser: "Chrome",
      },
    };

    const result = sanitizeCaptureResult(event);

    expect(result?.properties.$current_url).toBe(
      `https://x.test/c/1?token=${REDACTED}&a=1`,
    );
    expect(result?.properties.$referrer).toBe(
      `https://x.test/t/1/join?token=${REDACTED}`,
    );
    expect(result?.properties.$initial_referrer).toBe(
      `https://x.test/?token=${REDACTED}`,
    );
    expect(result?.properties.$initial_current_url).toBe(
      `https://x.test/?token=${REDACTED}`,
    );
    expect(result?.properties.$browser).toBe("Chrome");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("scrubs $set and $set_once URL properties", () => {
    const result = sanitizeCaptureResult({
      properties: {},
      $set: { $current_url: "https://x.test/?token=a", name: "n" },
      $set_once: {
        $initial_current_url: "https://x.test/?code=b",
        $initial_referrer: "https://x.test/?state=c",
      },
    });

    expect(result?.$set?.$current_url).toBe(`https://x.test/?token=${REDACTED}`);
    expect(result?.$set?.name).toBe("n");
    expect(result?.$set_once?.$initial_current_url).toBe(
      `https://x.test/?code=${REDACTED}`,
    );
    expect(result?.$set_once?.$initial_referrer).toBe(
      `https://x.test/?state=${REDACTED}`,
    );
  });

  it("redacts exception messages", () => {
    const result = sanitizeCaptureResult({
      properties: {
        $exception_list: [{ value: "GET /t/1/join?token=secret failed" }],
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("tolerates events without properties and null events", () => {
    expect(sanitizeCaptureResult(null)).toBeNull();
    expect(sanitizeCaptureResult({})).toEqual({});
  });
});
