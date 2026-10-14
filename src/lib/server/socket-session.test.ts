import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSelect, mockFrom, mockWhere, mockLimit } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock("$lib/db", () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
}));

import { readSessionTokens, resolveSessionUserId } from "./socket-session";

const SECURE = "__Secure-authjs.session-token";
const PLAIN = "authjs.session-token";

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue([]);
});

describe("readSessionTokens", () => {
  it.each([
    ["undefined", undefined],
    ["an empty header", ""],
    ["unrelated cookies", "theme=dark; lang=en"],
    ["a cookie without a value separator", "authjs.session-token"],
    ["an empty value", `${PLAIN}=`],
  ])("returns nothing for %s", (_, header) => {
    expect(readSessionTokens(header)).toEqual([]);
  });

  it("reads the plain session cookie", () => {
    expect(readSessionTokens(`${PLAIN}=abc`)).toEqual(["abc"]);
  });

  it("reads the secure-prefixed session cookie", () => {
    expect(readSessionTokens(`${SECURE}=abc`)).toEqual(["abc"]);
  });

  it("returns the secure token first regardless of header order", () => {
    expect(readSessionTokens(`${PLAIN}=plain; ${SECURE}=secure`)).toEqual([
      "secure",
      "plain",
    ]);
  });

  it("finds the session cookie among other cookies and tolerates whitespace", () => {
    expect(
      readSessionTokens(`theme=dark;   ${PLAIN} = tok ; other=1`),
    ).toEqual(["tok"]);
  });

  it("keeps '=' characters inside the value", () => {
    expect(readSessionTokens(`${PLAIN}=a=b==`)).toEqual(["a=b=="]);
  });

  it("uses the first occurrence of a duplicated cookie name", () => {
    expect(readSessionTokens(`${PLAIN}=first; ${PLAIN}=second`)).toEqual([
      "first",
    ]);
  });

  it("decodes percent-encoded values", () => {
    expect(readSessionTokens(`${PLAIN}=a%20b%2Fc`)).toEqual(["a b/c"]);
  });

  it("skips values with malformed percent-encoding", () => {
    expect(readSessionTokens(`${PLAIN}=%E0%A4%A`)).toEqual([]);
  });

  it("does not match cookie names by suffix or prefix", () => {
    expect(
      readSessionTokens(`x${PLAIN}=nope; ${PLAIN}x=nope; foo.${SECURE}=nope`),
    ).toEqual([]);
  });

  it("rejects oversized tokens and accepts the maximum length", () => {
    expect(readSessionTokens(`${PLAIN}=${"a".repeat(257)}`)).toEqual([]);
    expect(readSessionTokens(`${PLAIN}=${"a".repeat(256)}`)).toHaveLength(1);
  });
});

describe("resolveSessionUserId", () => {
  it("returns the user id of a valid session", async () => {
    mockLimit.mockResolvedValueOnce([{ userId: "user-1" }]);

    await expect(resolveSessionUserId(`${PLAIN}=tok`)).resolves.toBe("user-1");
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it("queries by token and only for sessions that have not expired", async () => {
    mockLimit.mockResolvedValueOnce([{ userId: "user-1" }]);
    const before = Date.now();

    await resolveSessionUserId(`${PLAIN}=tok-123`);

    const { sql: text, params } = new PgDialect().sqlToQuery(
      mockWhere.mock.calls[0][0],
    );
    expect(text).toMatch(/"sessionToken"\s*=/);
    expect(text).toMatch(/"expires"\s*>/);
    expect(params).toContain("tok-123");
    const cutoff = params.find((p) => typeof p === "string" && /^\d{4}-/.test(p));
    expect(new Date(cutoff as string).getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
  });

  it("returns null for an expired or unknown session (no matching row)", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(resolveSessionUserId(`${PLAIN}=expired`)).resolves.toBeNull();
  });

  it.each([
    ["no cookie header", undefined],
    ["an empty header", ""],
    ["unrelated cookies", "a=b"],
    ["a malformed session cookie", `${PLAIN}=%E0%A4%A`],
  ])("returns null without querying the database for %s", async (_, header) => {
    await expect(resolveSessionUserId(header)).resolves.toBeNull();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("falls back to the plain cookie when the secure one is not a live session", async () => {
    mockLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: "user-2" }]);

    await expect(
      resolveSessionUserId(`${SECURE}=stale; ${PLAIN}=live`),
    ).resolves.toBe("user-2");
    expect(mockLimit).toHaveBeenCalledTimes(2);
  });

  it("prefers the secure cookie when it is valid", async () => {
    mockLimit.mockResolvedValueOnce([{ userId: "user-1" }]);

    await expect(
      resolveSessionUserId(`${PLAIN}=plain; ${SECURE}=secure`),
    ).resolves.toBe("user-1");
    expect(mockLimit).toHaveBeenCalledOnce();
  });

  it("propagates database failures so the connection can be refused", async () => {
    mockLimit.mockRejectedValueOnce(new Error("db down"));

    await expect(resolveSessionUserId(`${PLAIN}=tok`)).rejects.toThrow(
      "db down",
    );
  });
});
