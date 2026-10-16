import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { buildCspDirectives, cspConfig } from "./csp.js";
import {
  HSTS_VALUE,
  PERMISSIONS_POLICY,
  securityHeadersHandle,
} from "./security-headers";

async function run(
  url: string,
  response: () => Response = () => new Response("ok"),
) {
  const event = { url: new URL(url) } as unknown as RequestEvent;
  return securityHeadersHandle({ event, resolve: async () => response() });
}

describe("securityHeadersHandle", () => {
  it("sets baseline headers on a plain response", async () => {
    const res = await run("http://localhost/");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers.get("Permissions-Policy")).toBe(PERMISSIONS_POLICY);
    expect(res.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("sets HSTS only over https and never preloads", async () => {
    const http = await run("http://localhost/");
    expect(http.headers.has("Strict-Transport-Security")).toBe(false);

    const https = await run("https://example.com/");
    expect(https.headers.get("Strict-Transport-Security")).toBe(HSTS_VALUE);
    expect(HSTS_VALUE).not.toContain("preload");
  });

  it.each([
    ["/t/abc/join", "no-referrer"],
    ["/t/abc/join/", "no-referrer"],
    ["/t/abc/join?token=x", "no-referrer"],
    ["/c/abc?token=x", "no-referrer"],
    ["/c/abc/slug?token=x", "no-referrer"],
    ["/d/abc?token=x", "no-referrer"],
    ["/c/abc", "strict-origin-when-cross-origin"],
    ["/d/abc", "strict-origin-when-cross-origin"],
    ["/t/abc/the-crew", "strict-origin-when-cross-origin"],
    ["/counters?token=x", "strict-origin-when-cross-origin"],
    ["/", "strict-origin-when-cross-origin"],
  ])("Referrer-Policy for %s is %s", async (path, expected) => {
    const res = await run(`http://localhost${path}`);
    expect(res.headers.get("Referrer-Policy")).toBe(expected);
  });

  it("does not override headers set by the response", async () => {
    const res = await run("https://example.com/", () => {
      const r = new Response("ok");
      r.headers.set("X-Frame-Options", "SAMEORIGIN");
      r.headers.set("Referrer-Policy", "origin");
      r.headers.set("Strict-Transport-Security", "max-age=1");
      return r;
    });
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("Referrer-Policy")).toBe("origin");
    expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=1");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("handles responses with immutable headers and keeps the body", async () => {
    const res = await run("http://localhost/", () => {
      const r = Response.redirect("http://localhost/login", 302);
      return r;
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("http://localhost/login");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("CSP config", () => {
  const prod = buildCspDirectives(true);
  const dev = buildCspDirectives(false);

  it("uses auto mode", () => {
    expect(cspConfig.mode).toBe("auto");
  });

  it("never allows unsafe-inline or unsafe-eval scripts", () => {
    for (const d of [prod, dev]) {
      expect(d["script-src"]).toEqual(["self"]);
    }
  });

  it("forbids framing, plugins and base-uri hijacking", () => {
    expect(prod["frame-ancestors"]).toEqual(["none"]);
    expect(prod["object-src"]).toEqual(["none"]);
    expect(prod["base-uri"]).toEqual(["self"]);
    expect(prod["default-src"]).toEqual(["self"]);
  });

  it("does not allow blanket https: images", () => {
    expect(prod["img-src"]).not.toContain("https:");
  });

  it("upgrades insecure requests only in production", () => {
    expect(prod["upgrade-insecure-requests"]).toBe(true);
    expect(dev["upgrade-insecure-requests"]).toBeUndefined();
  });
});
