import type { RequestEvent } from "@sveltejs/kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/db", () => ({ db: {} }));
vi.mock("$lib/db/schema", () => ({ globalSettings: {} }));
vi.mock("$lib/server/permissions", () => ({ getUserRole: vi.fn() }));
vi.mock("$lib/server/authorize", () => ({ canEditCounter: vi.fn() }));
vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  INGEST_MAX_BODY_BYTES,
  INGEST_RATE_LIMIT,
  posthogProxyHandle,
} from "./posthog-proxy";
import { resetRateLimitStore } from "./ratelimit";

const fetchMock = vi.fn();

function makeEvent(
  path: string,
  init: RequestInit & { ip?: string } = {},
): RequestEvent {
  const { ip, ...rest } = init;
  const url = new URL(`http://localhost${path}`);
  return {
    url,
    request: new Request(url, {
      ...rest,
      // Required by undici for streamed request bodies.
      ...(rest.body && typeof rest.body !== "string" ? { duplex: "half" } : {}),
    } as RequestInit),
    getClientAddress: () => ip ?? "203.0.113.20",
  } as unknown as RequestEvent;
}

async function run(event: RequestEvent) {
  const resolve = vi.fn(async () => new Response("app"));
  const response = await posthogProxyHandle({ event, resolve });
  return { response, resolve };
}

function upstreamOk(init?: ResponseInit) {
  fetchMock.mockResolvedValue(new Response('{"status":1}', init));
}

beforeEach(() => {
  resetRateLimitStore();
  fetchMock.mockReset();
  upstreamOk({ status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("posthogProxyHandle", () => {
  it("passes non-ingest paths through", async () => {
    const { response, resolve } = await run(makeEvent("/api/version"));
    expect(resolve).toHaveBeenCalled();
    expect(await response.text()).toBe("app");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not treat lookalike prefixes as ingest", async () => {
    const { resolve } = await run(makeEvent("/ingestion"));
    expect(resolve).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("request headers", () => {
    it("forwards only allowlisted headers", async () => {
      await run(
        makeEvent("/ingest/e/", {
          method: "POST",
          body: "x",
          headers: {
            "content-type": "text/plain",
            "content-encoding": "gzip",
            accept: "application/json",
            "accept-encoding": "gzip, br, zstd",
            "user-agent": "test-agent",
            cookie: "authjs.session-token=secret",
            authorization: "Bearer secret",
            origin: "https://app.example",
            referer: "https://app.example/c/1?token=secret",
            "x-forwarded-for": "6.6.6.6",
            "x-api-key": "k",
            host: "app.example",
          },
        }),
      );

      const [, init] = fetchMock.mock.calls[0];
      const sent = new Headers(init.headers);
      expect([...sent.keys()].sort()).toEqual([
        "accept",
        "accept-encoding",
        "content-encoding",
        "content-type",
        "user-agent",
        "x-forwarded-for",
      ]);
      expect(sent.get("content-type")).toBe("text/plain");
      expect(sent.get("user-agent")).toBe("test-agent");
      // Only encodings fetch() can decode are negotiated.
      expect(sent.get("accept-encoding")).toBe("gzip, br");
    });

    it("sets x-forwarded-for from getClientAddress, not the client header", async () => {
      await run(
        makeEvent("/ingest/decide/", {
          headers: { "x-forwarded-for": "6.6.6.6" },
          ip: "198.51.100.9",
        }),
      );
      const [, init] = fetchMock.mock.calls[0];
      expect(new Headers(init.headers).get("x-forwarded-for")).toBe(
        "198.51.100.9",
      );
    });

    it("never forwards cookies even when none are allowlisted", async () => {
      await run(makeEvent("/ingest/decide/", { headers: { cookie: "a=b" } }));
      const [, init] = fetchMock.mock.calls[0];
      expect(new Headers(init.headers).has("cookie")).toBe(false);
    });
  });

  describe("methods", () => {
    it.each(["PUT", "DELETE", "PATCH", "HEAD"])("rejects %s with 405", async (method) => {
      const { response } = await run(makeEvent("/ingest/e/", { method }));
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("GET, POST, OPTIONS");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(["GET", "OPTIONS"])("allows %s", async (method) => {
      const { response } = await run(makeEvent("/ingest/decide/", { method }));
      expect(response.status).toBe(200);
      expect(fetchMock.mock.calls[0][1].method).toBe(method);
    });

    it("allows POST", async () => {
      const { response } = await run(
        makeEvent("/ingest/e/", { method: "POST", body: "{}" }),
      );
      expect(response.status).toBe(200);
    });
  });

  describe("upstream routing", () => {
    it("sends event traffic to the ingestion host", async () => {
      await run(makeEvent("/ingest/e/?ip=1&_=2", { method: "POST", body: "x" }));
      const url = fetchMock.mock.calls[0][0] as URL;
      expect(url.hostname).toBe("eu.i.posthog.com");
      expect(url.pathname).toBe("/e/");
      expect(url.search).toBe("?ip=1&_=2");
    });

    it("sends static assets to the assets host", async () => {
      await run(makeEvent("/ingest/static/array.js"));
      const url = fetchMock.mock.calls[0][0] as URL;
      expect(url.hostname).toBe("eu-assets.i.posthog.com");
      expect(url.pathname).toBe("/static/array.js");
    });

    it("returns 502 when upstream fails", async () => {
      fetchMock.mockRejectedValue(new Error("boom"));
      const { response } = await run(makeEvent("/ingest/decide/"));
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: "Upstream unavailable" });
    });
  });

  describe("body size cap", () => {
    it("rejects oversized bodies declared via content-length with 413", async () => {
      const { response } = await run(
        makeEvent("/ingest/e/", {
          method: "POST",
          body: "x",
          headers: {
            "content-length": String(INGEST_MAX_BODY_BYTES + 1),
          },
        }),
      );
      expect(response.status).toBe(413);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects oversized bodies while streaming, without content-length", async () => {
      const chunk = new Uint8Array(256 * 1024);
      let sent = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent >= 6) return controller.close();
          sent++;
          controller.enqueue(chunk);
        },
      });

      const { response } = await run(
        makeEvent("/ingest/e/", { method: "POST", body: stream }),
      );
      expect(response.status).toBe(413);
      expect(fetchMock).not.toHaveBeenCalled();
      // Stopped reading as soon as the cap was exceeded.
      expect(sent).toBeLessThan(6);
    });

    it("accepts a body exactly at the cap", async () => {
      const { response } = await run(
        makeEvent("/ingest/e/", {
          method: "POST",
          body: new Uint8Array(INGEST_MAX_BODY_BYTES),
        }),
      );
      expect(response.status).toBe(200);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.body.byteLength).toBe(INGEST_MAX_BODY_BYTES);
    });
  });

  describe("response handling", () => {
    it("does not forward set-cookie", async () => {
      const upstream = new Response("{}", {
        status: 200,
        headers: [
          ["set-cookie", "ph_session=abc; Path=/"],
          ["content-type", "application/json"],
          ["x-custom", "kept"],
        ],
      });
      fetchMock.mockResolvedValue(upstream);

      const { response } = await run(makeEvent("/ingest/decide/"));
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(response.headers.get("x-custom")).toBe("kept");
    });

    it("preserves upstream status", async () => {
      upstreamOk({ status: 400 });
      const { response } = await run(
        makeEvent("/ingest/e/", { method: "POST", body: "x" }),
      );
      expect(response.status).toBe(400);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 with Retry-After after the per-IP limit", async () => {
      for (let i = 0; i < INGEST_RATE_LIMIT.limit; i++) {
        const { response } = await run(makeEvent("/ingest/decide/"));
        expect(response.status).toBe(200);
      }
      const { response } = await run(makeEvent("/ingest/decide/"));
      expect(response.status).toBe(429);
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(await response.json()).toMatchObject({ error: "Too many requests" });
    });

    it("limits per client address, not per spoofed header", async () => {
      for (let i = 0; i < INGEST_RATE_LIMIT.limit; i++) {
        await run(makeEvent("/ingest/decide/", { ip: "198.51.100.30" }));
      }
      const spoofed = await run(
        makeEvent("/ingest/decide/", {
          ip: "198.51.100.30",
          headers: { "x-forwarded-for": "1.2.3.4" },
        }),
      );
      expect(spoofed.response.status).toBe(429);
      const other = await run(
        makeEvent("/ingest/decide/", { ip: "198.51.100.31" }),
      );
      expect(other.response.status).toBe(200);
    });
  });
});
