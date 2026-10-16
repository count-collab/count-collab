import type { RequestEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { logger } = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("$lib/server/logger", () => ({ logger }));

import { loggingHandle } from "./request-logging";

function makeEvent(url: string, method = "GET"): RequestEvent {
  const parsed = new URL(`http://localhost${url}`);
  return {
    url: parsed,
    request: new Request(parsed, { method }),
    route: { id: "/t/[id]/join" },
  } as unknown as RequestEvent;
}

const allLogged = () => JSON.stringify(Object.values(logger).flatMap((fn) => fn.mock.calls));

beforeEach(() => vi.clearAllMocks());

describe("loggingHandle", () => {
  it("redacts token, code and state query values", async () => {
    await loggingHandle({
      event: makeEvent("/t/1/join?token=s3cret&code=oauthcode&state=csrfstate&page=2"),
      resolve: async () => new Response("ok"),
    });

    const [message, meta] = logger.info.mock.calls[0];
    expect(message).toBe("--> GET /t/1/join");
    expect(meta.query).toBe(
      "?token=[redacted]&code=[redacted]&state=[redacted]&page=2",
    );
    const logged = allLogged();
    expect(logged).not.toContain("s3cret");
    expect(logged).not.toContain("oauthcode");
    expect(logged).not.toContain("csrfstate");
  });

  it("redacts token-like parameter names and mixed case", async () => {
    await loggingHandle({
      event: makeEvent("/x?shareToken=abc&join_token=def&CODE=ghi&State=jkl"),
      resolve: async () => new Response("ok"),
    });
    const logged = allLogged();
    for (const secret of ["abc", "def", "ghi", "jkl"]) {
      expect(logged).not.toContain(`=${secret}`);
    }
  });

  it("leaves harmless query strings intact and omits empty ones", async () => {
    await loggingHandle({
      event: makeEvent("/c?sort=asc"),
      resolve: async () => new Response("ok"),
    });
    expect(logger.info.mock.calls[0][1].query).toBe("?sort=asc");

    logger.info.mockClear();
    await loggingHandle({
      event: makeEvent("/c"),
      resolve: async () => new Response("ok"),
    });
    expect(logger.info.mock.calls[0][1].query).toBeUndefined();
  });

  it("logs response status at the matching level", async () => {
    await loggingHandle({
      event: makeEvent("/a"),
      resolve: async () => new Response("no", { status: 404 }),
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "<-- GET /a 404",
      expect.objectContaining({ status: 404 }),
    );

    await loggingHandle({
      event: makeEvent("/a"),
      resolve: async () => new Response("err", { status: 500 }),
    });
    expect(logger.error).toHaveBeenCalledWith(
      "<-- GET /a 500",
      expect.objectContaining({ status: 500 }),
    );
  });

  it("redacts tokens in unhandled error messages and rethrows", async () => {
    const failure = new Error("failed fetching /t/1/join?token=s3cret");
    await expect(
      loggingHandle({
        event: makeEvent("/t/1/join"),
        resolve: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(allLogged()).not.toContain("s3cret");
    expect(allLogged()).toContain("token=[redacted]");
  });
});
