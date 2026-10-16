import type { RequestEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockWhere, mockGetUserRole, mockGetRateLimitConfig } = vi.hoisted(
  () => ({
    mockWhere: vi.fn(),
    mockGetUserRole: vi.fn(),
    mockGetRateLimitConfig: vi.fn(),
  }),
);

vi.mock("$lib/db", () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: mockWhere,
  };
  return { db: chain };
});

vi.mock("$lib/db/schema", () => ({
  globalSettings: { id: "id" },
  counters: { id: "id", visibilityMode: "visibilityMode" },
}));

vi.mock("$lib/server/permissions", () => ({ getUserRole: mockGetUserRole }));
vi.mock("$lib/server/authorize", () => ({ canEditCounter: vi.fn() }));
vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("$lib/server/ratelimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ratelimit")>()),
  getRateLimitConfig: mockGetRateLimitConfig,
}));

import {
  API_LIMITS,
  ipRateLimitHandle,
  THROTTLE_RULES,
  userRateLimitHandle,
} from "./api-rate-limit";
import { resetRateLimitStore, resetSettingsCache } from "./ratelimit";

const ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const UPPER_ID = ID.toUpperCase();

interface EventOptions {
  method?: string;
  ip?: string;
  userId?: string;
  headers?: Record<string, string>;
}

function makeEvent(path: string, opts: EventOptions = {}): RequestEvent {
  const url = new URL(`http://localhost${path}`);
  return {
    url,
    request: new Request(url, {
      method: opts.method ?? "GET",
      headers: opts.headers,
    }),
    getClientAddress: () => opts.ip ?? "203.0.113.10",
    locals: {
      auth: async () => (opts.userId ? { user: { id: opts.userId } } : null),
    },
  } as unknown as RequestEvent;
}

const ok = () => new Response("ok", { status: 200 });

async function runIp(path: string, opts?: EventOptions) {
  return ipRateLimitHandle({
    event: makeEvent(path, opts),
    resolve: async () => ok(),
  });
}

async function runUser(path: string, opts?: EventOptions) {
  return userRateLimitHandle({
    event: makeEvent(path, opts),
    resolve: async () => ok(),
  });
}

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    counterCreationLimitAuth: 5,
    counterCreationWindowAuth: 60,
    counterCreationLimitUnauth: 2,
    counterCreationWindowUnauth: 60,
    dashboardCreationLimitAuth: 5,
    dashboardCreationWindowAuth: 60,
    dashboardCreationLimitUnauth: 2,
    dashboardCreationWindowUnauth: 60,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStore();
  resetSettingsCache();
  mockGetUserRole.mockResolvedValue("user");
  mockGetRateLimitConfig.mockResolvedValue({
    increment: { windowMs: 30_000, maxRequests: 1 },
  });
  mockWhere.mockResolvedValue([{ visibilityMode: "public" }]);
});

describe("increment limiter", () => {
  it("limits an uppercase UUID and shares the bucket with lowercase", async () => {
    expect((await runUser(`/api/counters/${UPPER_ID}`, { method: "POST" })).status).toBe(200);

    const second = await runUser(`/api/counters/${ID}`, { method: "POST" });
    expect(second.status).toBe(429);
    expect(Number(second.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(second.headers.get("Content-Type")).toBe("application/json");
    expect(await second.json()).toMatchObject({ error: "Too many requests" });
  });

  it("limits uppercase ids on their own too", async () => {
    await runUser(`/api/counters/${UPPER_ID}`, { method: "POST" });
    const second = await runUser(`/api/counters/${UPPER_ID}`, { method: "POST" });
    expect(second.status).toBe(429);
  });

  it("fails closed to the public limit when the counter is unknown", async () => {
    mockWhere.mockResolvedValue([]);
    await runUser(`/api/counters/${ID}`, { method: "POST" });
    expect((await runUser(`/api/counters/${ID}`, { method: "POST" })).status).toBe(429);
  });

  it("fails closed when the visibility lookup throws", async () => {
    mockWhere.mockRejectedValue(new Error("db down"));
    await runUser(`/api/counters/${ID}`, { method: "POST" });
    expect((await runUser(`/api/counters/${ID}`, { method: "POST" })).status).toBe(429);
  });

  it("only exempts private counters from the global cooldown", async () => {
    mockWhere.mockResolvedValue([{ visibilityMode: "private" }]);
    for (let i = 0; i < 3; i++) {
      expect((await runUser(`/api/counters/${ID}`, { method: "POST" })).status).toBe(200);
    }
  });

  it("never treats a malformed id as private", async () => {
    mockWhere.mockResolvedValue([{ visibilityMode: "private" }]);
    await runUser("/api/counters/abc-def", { method: "POST" });
    expect((await runUser("/api/counters/abc-def", { method: "POST" })).status).toBe(429);
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it("ignores spoofed X-Forwarded-For and X-Real-IP", async () => {
    await runUser(`/api/counters/${ID}`, {
      method: "POST",
      headers: { "x-forwarded-for": "1.1.1.1", "x-real-ip": "1.1.1.1" },
    });
    const second = await runUser(`/api/counters/${ID}`, {
      method: "POST",
      headers: { "x-forwarded-for": "2.2.2.2", "x-real-ip": "2.2.2.2" },
    });
    expect(second.status).toBe(429);
  });

  it("gives a different real address its own quota", async () => {
    await runUser(`/api/counters/${ID}`, { method: "POST", ip: "198.51.100.1" });
    expect(
      (await runUser(`/api/counters/${ID}`, { method: "POST", ip: "198.51.100.2" })).status,
    ).toBe(200);
  });

  it("exempts admins from the cooldown", async () => {
    mockGetUserRole.mockResolvedValue("admin");
    for (let i = 0; i < 3; i++) {
      expect(
        (await runUser(`/api/counters/${ID}`, { method: "POST", userId: "admin-1" })).status,
      ).toBe(200);
    }
  });
});

describe("generic IP limits", () => {
  it("limits non-GET /api requests at 120/min", async () => {
    for (let i = 0; i < API_LIMITS.mutatingPerIp.limit; i++) {
      expect((await runIp("/api/teams", { method: "PATCH" })).status).toBe(200);
    }
    const limited = await runIp("/api/teams", { method: "PATCH" });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({ error: "Too many requests" });
  });

  it("limits /api reads at 600/min, separately from mutations", async () => {
    for (let i = 0; i < API_LIMITS.readPerIp.limit; i++) {
      await runIp("/api/version");
    }
    expect((await runIp("/api/version")).status).toBe(429);
    expect((await runIp("/api/teams", { method: "POST" })).status).toBe(200);
  });

  it("does not limit non-API page GETs", async () => {
    for (let i = 0; i < API_LIMITS.readPerIp.limit + 5; i++) {
      expect((await runIp("/about")).status).toBe(200);
    }
  });

  it("skips /health, static assets and the PostHog proxy", async () => {
    for (let i = 0; i < 700; i++) {
      expect((await runIp("/health", { method: "POST" })).status).toBe(200);
      expect((await runIp("/_app/immutable/x.js", { method: "POST" })).status).toBe(200);
    }
  });

  it("covers Auth.js routes with the mutating limit", async () => {
    for (let i = 0; i < API_LIMITS.mutatingPerIp.limit; i++) {
      await runIp("/api/auth/signin/discord", { method: "POST" });
    }
    expect((await runIp("/api/auth/signin/discord", { method: "POST" })).status).toBe(429);
  });

  it("is not bypassed by spoofed forwarding headers", async () => {
    for (let i = 0; i < API_LIMITS.mutatingPerIp.limit; i++) {
      await runIp("/api/teams", {
        method: "PATCH",
        headers: { "x-forwarded-for": `10.0.0.${i}` },
      });
    }
    const res = await runIp("/api/teams", {
      method: "PATCH",
      headers: { "x-forwarded-for": "9.9.9.9" },
    });
    expect(res.status).toBe(429);
  });
});

describe("throttle rules", () => {
  const cases: [string, string, string, number][] = [
    ["og", "GET", `/api/og/${ID}`, 60],
    ["username check", "GET", "/api/username/check", 30],
    ["admin user search", "GET", "/api/admin/users/search", 60],
    ["dashboard counter search", "GET", `/api/dashboards/${ID}/search-counters`, 60],
    ["sitemap", "GET", "/sitemap.xml", 10],
    ["sitemap alt", "GET", "/sitemap_alt.xml", 10],
    ["counter invite", "POST", `/c/${ID}/members`, 30],
    ["team invite", "POST", `/t/${ID}/members`, 30],
    ["re-invite", "PATCH", `/c/${ID}/invitations/${ID}`, 30],
    ["follow", "POST", `/api/counters/${ID}/follow`, 60],
    ["goal create", "POST", `/api/counters/${ID}/goals`, 30],
    ["team join", "POST", `/api/teams/${ID}/join`, 10],
    ["counter transfer", "POST", `/api/counters/${ID}/transfer`, 20],
    ["dashboard transfer", "POST", `/api/dashboards/${ID}/transfer`, 20],
    ["join-link", "POST", `/api/teams/${ID}/join-link`, 20],
  ];

  it.each(cases)("%s is limited per IP", async (_name, method, path, limit) => {
    for (let i = 0; i < limit; i++) {
      expect((await runIp(path, { method })).status).toBe(200);
    }
    const limited = await runIp(path, { method });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });

  it("matches encoded and slash-padded paths", async () => {
    for (let i = 0; i < 10; i++) await runIp("/sitemap.xml");
    expect((await runIp("//sitemap.xml")).status).toBe(429);
    expect((await runIp("/sitemap.xml/")).status).toBe(429);
  });

  it("has a per-user budget on every authenticated mutating rule", () => {
    const withoutUser = THROTTLE_RULES.filter(
      (r) => r.methods.some((m) => !["GET", "HEAD"].includes(m)) && !r.user,
    );
    expect(withoutUser).toEqual([]);
  });
});

describe("per-user limits", () => {
  it("limits a user across IPs with their own budget", async () => {
    const path = `/api/teams/${ID}/join-link`;
    for (let i = 0; i < 10; i++) {
      expect(
        (await runUser(path, { method: "POST", userId: "u-1", ip: `198.51.100.${i}` })).status,
      ).toBe(200);
    }
    const limited = await runUser(path, {
      method: "POST",
      userId: "u-1",
      ip: "198.51.100.200",
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });

  it("does not let other users or anonymous traffic consume a user's budget", async () => {
    const path = `/api/teams/${ID}/join-link`;
    for (let i = 0; i < 10; i++) {
      await runUser(path, { method: "POST", userId: "u-1", ip: "198.51.100.1" });
    }
    expect(
      (await runUser(path, { method: "POST", userId: "u-2", ip: "198.51.100.1" })).status,
    ).toBe(200);
  });

  it("keys the user bucket separately from the IP bucket", async () => {
    // Same string as both user id and IP: the quotas must not be shared.
    const path = `/api/teams/${ID}/join`;
    for (let i = 0; i < 10; i++) {
      await runIp(path, { method: "POST", ip: "203.0.113.50" });
    }
    expect((await runIp(path, { method: "POST", ip: "203.0.113.50" })).status).toBe(429);
    expect(
      (await runUser(path, { method: "POST", userId: "203.0.113.50", ip: "203.0.113.50" })).status,
    ).toBe(200);
  });

  it("applies the generic mutating user budget", async () => {
    for (let i = 0; i < API_LIMITS.mutatingPerUser.limit; i++) {
      await runUser("/api/teams", { method: "PATCH", userId: "u-3", ip: `10.1.0.${i % 200}` });
    }
    expect((await runUser("/api/teams", { method: "PATCH", userId: "u-3" })).status).toBe(429);
  });
});

describe("creation limits come from admin settings", () => {
  it("POST /api/counters uses counterCreation* settings", async () => {
    mockWhere.mockResolvedValue([settingsRow({ counterCreationLimitUnauth: 1 })]);

    expect((await runUser("/api/counters", { method: "POST" })).status).toBe(200);
    const limited = await runUser("/api/counters", { method: "POST" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });

  it("POST /api/dashboards uses dashboardCreation* settings per user", async () => {
    mockWhere.mockResolvedValue([settingsRow({ dashboardCreationLimitAuth: 2 })]);

    expect((await runUser("/api/dashboards", { method: "POST", userId: "d-1" })).status).toBe(200);
    expect((await runUser("/api/dashboards", { method: "POST", userId: "d-1" })).status).toBe(200);
    expect((await runUser("/api/dashboards", { method: "POST", userId: "d-1" })).status).toBe(429);
    expect((await runUser("/api/dashboards", { method: "POST", userId: "d-2" })).status).toBe(200);
  });

  it("defaults to 5 per minute when settings are unreadable", async () => {
    mockWhere.mockRejectedValue(new Error("db down"));
    for (let i = 0; i < 5; i++) {
      expect((await runUser("/api/counters", { method: "POST", userId: "d-9" })).status).toBe(200);
    }
    expect((await runUser("/api/counters", { method: "POST", userId: "d-9" })).status).toBe(429);
  });
});
