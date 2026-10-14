import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUserRole,
  mockCanEditCounter,
  mockDbSelect,
  mockDbFrom,
  mockDbWhere,
  mockDbInsert,
  mockDbValues,
  mockDbOnConflictDoNothing,
  mockDbReturning,
} = vi.hoisted(() => ({
  mockGetUserRole: vi.fn(),
  mockCanEditCounter: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbFrom: vi.fn(),
  mockDbWhere: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbValues: vi.fn(),
  mockDbOnConflictDoNothing: vi.fn(),
  mockDbReturning: vi.fn(),
}));

vi.mock("$lib/db", () => {
  const chain = {
    select: mockDbSelect,
    from: mockDbFrom,
    where: mockDbWhere,
    insert: mockDbInsert,
    values: mockDbValues,
    onConflictDoNothing: mockDbOnConflictDoNothing,
    returning: mockDbReturning,
  };
  mockDbSelect.mockReturnValue(chain);
  mockDbFrom.mockReturnValue(chain);
  mockDbWhere.mockReturnValue(chain);
  mockDbInsert.mockReturnValue(chain);
  mockDbValues.mockReturnValue(chain);
  mockDbOnConflictDoNothing.mockReturnValue(chain);
  mockDbReturning.mockResolvedValue([]);
  return { db: chain };
});

vi.mock("$lib/db/schema", () => ({
  globalSettings: { id: "id" },
  counterGoals: {},
  counterHistory: {},
  users: {},
  counters: {},
  counterMembers: {},
  permissions: {},
  rolePermissions: {},
  roles: {},
}));

vi.mock("$lib/server/permissions", () => ({
  getUserRole: mockGetUserRole,
}));

vi.mock("$lib/server/authorize", () => ({
  canEditCounter: mockCanEditCounter,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  checkCounterCooldown,
  checkCreationRateLimit,
  checkPrivateCounterCooldown,
  checkRateLimit,
  checkTeamCreationRateLimit,
  checkUserRateLimit,
  getClientIp,
  getCreationRateLimitConfig,
  getEffectiveCooldownMs,
  getRateLimitStoreSize,
  getTeamCreationRateLimitConfig,
  MAX_RATE_LIMIT_ENTRIES,
  PRIVATE_COUNTER_DEBOUNCE_MS,
  recordCounterCooldown,
  resetCounterCooldownStore,
  resetRateLimitStore,
  resetSettingsCache,
  UNKNOWN_IP,
} from "./ratelimit";

// Use unique IPs per test to avoid in-memory state collisions
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter++;
  return `10.${Math.floor(ipCounter / 65536) % 256}.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when under limit", () => {
    const result = checkRateLimit(uniqueIp(), "/api/counters/[id]", {
      windowMs: 5000,
      maxRequests: 3,
    });
    expect(result).toBeNull();
  });

  it("returns retryAfter when over limit", () => {
    const ip = uniqueIp();
    const config = { windowMs: 5000, maxRequests: 2 };

    // First two requests should succeed
    expect(checkRateLimit(ip, "/api/test", config)).toBeNull();
    expect(checkRateLimit(ip, "/api/test", config)).toBeNull();

    // Third request should be limited
    const result = checkRateLimit(ip, "/api/test", config);
    expect(result).not.toBeNull();
    expect(result?.retryAfter).toBeGreaterThan(0);
  });

  it("properly tracks timestamps in sliding window", async () => {
    const ip = uniqueIp();
    const config = { windowMs: 100, maxRequests: 1 };

    // First request
    expect(checkRateLimit(ip, "/api/test", config)).toBeNull();

    // Immediately after — should be limited
    const limited = checkRateLimit(ip, "/api/test", config);
    expect(limited).not.toBeNull();

    // After window expires, should be allowed again
    await new Promise((r) => setTimeout(r, 110));
    const afterWindow = checkRateLimit(ip, "/api/test", config);
    expect(afterWindow).toBeNull();
  });

  it("tracks different routes independently", () => {
    const ip = uniqueIp();
    const config = { windowMs: 5000, maxRequests: 1 };

    expect(checkRateLimit(ip, "/api/route-a", config)).toBeNull();
    expect(checkRateLimit(ip, "/api/route-b", config)).toBeNull();

    // Both routes are now at limit
    expect(checkRateLimit(ip, "/api/route-a", config)).not.toBeNull();
    expect(checkRateLimit(ip, "/api/route-b", config)).not.toBeNull();
  });

  it("tracks different IPs independently", () => {
    const config = { windowMs: 5000, maxRequests: 1 };

    expect(checkRateLimit(uniqueIp(), "/api/test", config)).toBeNull();
    expect(checkRateLimit(uniqueIp(), "/api/test", config)).toBeNull();
  });
});

function mockGlobalSettings(overrides: Record<string, unknown> = {}) {
  const defaults = {
    id: 1,
    counterCreationLimitAuth: 5,
    counterCreationWindowAuth: 60,
    counterCreationLimitUnauth: 2,
    counterCreationWindowUnauth: 60,
    dashboardCreationLimitAuth: 5,
    dashboardCreationWindowAuth: 60,
    dashboardCreationLimitUnauth: 2,
    dashboardCreationWindowUnauth: 60,
    teamCreationLimitAuth: 3,
    teamCreationWindowAuth: 60,
    incrementCooldownMsAuth: 5000,
    incrementCooldownMsUnauth: 30000,
    updatedAt: new Date(),
    ...overrides,
  };
  mockDbWhere.mockResolvedValue([defaults]);
  mockDbReturning.mockResolvedValue([defaults]);
  return defaults;
}

function resetDbChain() {
  const chain = {
    select: mockDbSelect,
    from: mockDbFrom,
    where: mockDbWhere,
    insert: mockDbInsert,
    values: mockDbValues,
    onConflictDoNothing: mockDbOnConflictDoNothing,
    returning: mockDbReturning,
  };
  mockDbSelect.mockReturnValue(chain);
  mockDbFrom.mockReturnValue(chain);
  mockDbWhere.mockReturnValue(chain);
  mockDbInsert.mockReturnValue(chain);
  mockDbValues.mockReturnValue(chain);
  mockDbOnConflictDoNothing.mockReturnValue(chain);
}

describe("getEffectiveCooldownMs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSettingsCache();
    resetDbChain();
  });

  it("returns 0 for admin users", async () => {
    mockGetUserRole.mockResolvedValue("admin");
    mockGlobalSettings();

    const result = await getEffectiveCooldownMs("counter-1", "user-admin", {
      cooldownEnabled: true,
      cooldownSeconds: 30,
      ownerId: null,
    });
    expect(result).toBe(0);
  });

  it("returns global cooldown for unauthenticated users when counter has no cooldown", async () => {
    mockGlobalSettings({ incrementCooldownMsUnauth: 30000 });

    const result = await getEffectiveCooldownMs("counter-1", undefined, {
      cooldownEnabled: false,
      cooldownSeconds: 10,
      ownerId: "owner-1",
    });
    expect(result).toBe(30000);
  });

  it("returns counter cooldown when it's higher than global", async () => {
    mockGetUserRole.mockResolvedValue("user");
    mockCanEditCounter.mockResolvedValue(false);
    mockGlobalSettings({ incrementCooldownMsAuth: 5000 });

    const result = await getEffectiveCooldownMs("counter-1", "user-regular", {
      cooldownEnabled: true,
      cooldownSeconds: 10,
      ownerId: "owner-1",
    });
    // counter cooldown = 10 * 1000 = 10000, global = 5000, max = 10000
    expect(result).toBe(10000);
  });

  it("returns global cooldown when it's higher than counter cooldown", async () => {
    mockGetUserRole.mockResolvedValue("user");
    mockCanEditCounter.mockResolvedValue(false);
    mockGlobalSettings({ incrementCooldownMsAuth: 15000 });

    const result = await getEffectiveCooldownMs("counter-1", "user-regular", {
      cooldownEnabled: true,
      cooldownSeconds: 5,
      ownerId: "owner-1",
    });
    // counter cooldown = 5 * 1000 = 5000, global = 15000, max = 15000
    expect(result).toBe(15000);
  });

  it("returns only global cooldown for counter owners/editors even when counter cooldown is set", async () => {
    mockGetUserRole.mockResolvedValue("user");
    mockCanEditCounter.mockResolvedValue(true);
    mockGlobalSettings({ incrementCooldownMsAuth: 5000 });

    const result = await getEffectiveCooldownMs("counter-1", "user-editor", {
      cooldownEnabled: true,
      cooldownSeconds: 30,
      ownerId: "owner-1",
    });
    // Editors are exempt from counter cooldown, only global applies
    expect(result).toBe(5000);
  });

  it("returns counter cooldown for non-owners when counter cooldown is enabled", async () => {
    mockGetUserRole.mockResolvedValue("user");
    mockCanEditCounter.mockResolvedValue(false);
    mockGlobalSettings({ incrementCooldownMsAuth: 5000 });

    const result = await getEffectiveCooldownMs("counter-1", "user-visitor", {
      cooldownEnabled: true,
      cooldownSeconds: 20,
      ownerId: "owner-1",
    });
    // counter cooldown = 20 * 1000 = 20000, global = 5000, max = 20000
    expect(result).toBe(20000);
  });
});

describe("checkCounterCooldown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSettingsCache();
    resetCounterCooldownStore();
    resetDbChain();
  });

  it("returns blocked=false with cooldownSeconds=0 for admin users", async () => {
    mockGetUserRole.mockResolvedValue("admin");
    mockGlobalSettings();

    const result = await checkCounterCooldown("counter-1", "user-admin", {
      cooldownEnabled: true,
      cooldownSeconds: 30,
      ownerId: null,
    });
    expect(result).toEqual({ blocked: false, cooldownSeconds: 0 });
  });

  it("returns blocked=false with global cooldown for editors", async () => {
    mockGetUserRole.mockResolvedValue("user");
    mockCanEditCounter.mockResolvedValue(true);
    mockGlobalSettings({ incrementCooldownMsAuth: 5000 });

    // Record a recent cooldown that would block normal users
    recordCounterCooldown("counter-1");

    const result = await checkCounterCooldown("counter-1", "user-editor", {
      cooldownEnabled: true,
      cooldownSeconds: 30,
      ownerId: "owner-1",
    });
    expect(result).toEqual({ blocked: false, cooldownSeconds: 5 });
  });

  it("returns blocked=false with global cooldown when cooldown is disabled", async () => {
    mockGetUserRole.mockResolvedValue("user");
    mockCanEditCounter.mockResolvedValue(false);
    mockGlobalSettings({ incrementCooldownMsAuth: 5000 });

    const result = await checkCounterCooldown("counter-1", "user-regular", {
      cooldownEnabled: false,
      cooldownSeconds: 30,
      ownerId: "owner-1",
    });
    expect(result).toEqual({ blocked: false, cooldownSeconds: 5 });
  });

  it("returns blocked=true when counter cooldown is active", async () => {
    mockGetUserRole.mockResolvedValue("user");
    mockCanEditCounter.mockResolvedValue(false);
    mockGlobalSettings({ incrementCooldownMsAuth: 5000 });

    recordCounterCooldown("counter-1");

    const result = await checkCounterCooldown("counter-1", "user-regular", {
      cooldownEnabled: true,
      cooldownSeconds: 10,
      ownerId: "owner-1",
    });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(10);
    }
  });

  it("returns blocked=false when cooldown has expired", async () => {
    mockGetUserRole.mockResolvedValue("user");
    mockCanEditCounter.mockResolvedValue(false);
    mockGlobalSettings({ incrementCooldownMsAuth: 5000 });

    // Simulate an old cooldown by directly setting the store
    // We need to record then wait — use a very short cooldown to test expiry
    const result = await checkCounterCooldown("counter-new", "user-regular", {
      cooldownEnabled: true,
      cooldownSeconds: 10,
      ownerId: "owner-1",
    });
    expect(result).toEqual({ blocked: false, cooldownSeconds: 10 });
  });

  it("returns blocked=false for unauthenticated users with global cooldown when no counter cooldown", async () => {
    mockGlobalSettings({ incrementCooldownMsUnauth: 30000 });

    const result = await checkCounterCooldown("counter-1", undefined, {
      cooldownEnabled: false,
      cooldownSeconds: 0,
      ownerId: "owner-1",
    });
    expect(result).toEqual({ blocked: false, cooldownSeconds: 30 });
  });

  it("uses max of global and counter cooldown for effective cooldown", async () => {
    mockGetUserRole.mockResolvedValue("user");
    mockCanEditCounter.mockResolvedValue(false);
    mockGlobalSettings({ incrementCooldownMsAuth: 15000 });

    const result = await checkCounterCooldown(
      "counter-unused",
      "user-regular",
      {
        cooldownEnabled: true,
        cooldownSeconds: 5, // 5000ms < 15000ms global
        ownerId: "owner-1",
      },
    );
    // Should use global (15s) since it's higher
    expect(result).toEqual({ blocked: false, cooldownSeconds: 15 });
  });
});

describe("checkPrivateCounterCooldown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCounterCooldownStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns blocked=false with cooldownSeconds=0 for admins", async () => {
    mockGetUserRole.mockResolvedValue("admin");

    const result = await checkPrivateCounterCooldown(
      "counter-private-1",
      "admin-1",
      {
        cooldownEnabled: true,
        cooldownSeconds: 10,
      },
    );

    expect(result).toEqual({ blocked: false, cooldownSeconds: 0 });
  });

  it("enforces debounce when private cooldown is disabled", async () => {
    mockGetUserRole.mockResolvedValue("user");

    const first = await checkPrivateCounterCooldown(
      "counter-private-2",
      "user-1",
      {
        cooldownEnabled: false,
        cooldownSeconds: 0,
      },
    );
    expect(first).toEqual({ blocked: false, cooldownSeconds: 0 });

    recordCounterCooldown("counter-private-2");

    const second = await checkPrivateCounterCooldown(
      "counter-private-2",
      "user-1",
      {
        cooldownEnabled: false,
        cooldownSeconds: 0,
      },
    );

    expect(second.blocked).toBe(true);
    if (second.blocked) {
      expect(second.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("unblocks after 100ms debounce when private cooldown is disabled", async () => {
    mockGetUserRole.mockResolvedValue("user");
    const nowSpy = vi.spyOn(Date, "now");

    nowSpy.mockReturnValue(1_000);
    recordCounterCooldown("counter-private-2b");

    nowSpy.mockReturnValue(1_050);
    const duringDebounce = await checkPrivateCounterCooldown(
      "counter-private-2b",
      "user-1",
      {
        cooldownEnabled: false,
        cooldownSeconds: 0,
      },
    );
    expect(duringDebounce.blocked).toBe(true);

    nowSpy.mockReturnValue(1_101);
    const afterDebounce = await checkPrivateCounterCooldown(
      "counter-private-2b",
      "user-1",
      {
        cooldownEnabled: false,
        cooldownSeconds: 0,
      },
    );
    expect(afterDebounce).toEqual({ blocked: false, cooldownSeconds: 0 });
  });

  it("enforces counter-specific cooldown when enabled", async () => {
    mockGetUserRole.mockResolvedValue("user");
    recordCounterCooldown("counter-private-3");

    const result = await checkPrivateCounterCooldown(
      "counter-private-3",
      "user-1",
      {
        cooldownEnabled: true,
        cooldownSeconds: 5,
      },
    );

    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(5);
    }
  });

  it("keeps private counter blocked until configured cooldown expires when enabled", async () => {
    mockGetUserRole.mockResolvedValue("user");
    const nowSpy = vi.spyOn(Date, "now");

    nowSpy.mockReturnValue(2_000);
    recordCounterCooldown("counter-private-3b");

    nowSpy.mockReturnValue(3_500);
    const beforeConfiguredCooldown = await checkPrivateCounterCooldown(
      "counter-private-3b",
      "user-1",
      {
        cooldownEnabled: true,
        cooldownSeconds: 2,
      },
    );
    expect(beforeConfiguredCooldown.blocked).toBe(true);

    nowSpy.mockReturnValue(4_001);
    const afterConfiguredCooldown = await checkPrivateCounterCooldown(
      "counter-private-3b",
      "user-1",
      {
        cooldownEnabled: true,
        cooldownSeconds: 2,
      },
    );
    expect(afterConfiguredCooldown).toEqual({
      blocked: false,
      cooldownSeconds: 2,
    });
  });

  it("applies debounce minimum even when configured cooldown is lower", async () => {
    mockGetUserRole.mockResolvedValue("user");

    const result = await checkPrivateCounterCooldown(
      "counter-private-4",
      "user-1",
      {
        cooldownEnabled: true,
        cooldownSeconds: 0,
      },
    );

    expect(result).toEqual({
      blocked: false,
      cooldownSeconds: Math.ceil(PRIVATE_COUNTER_DEBOUNCE_MS / 1000),
    });
  });
});

describe("team creation rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSettingsCache();
    resetDbChain();
  });

  it("reads the limit and window from global settings", async () => {
    mockGlobalSettings({
      teamCreationLimitAuth: 4,
      teamCreationWindowAuth: 120,
    });

    expect(await getTeamCreationRateLimitConfig()).toEqual({
      windowMs: 120_000,
      maxRequests: 4,
    });
  });

  it("blocks a user after reaching the limit", async () => {
    mockGlobalSettings({
      teamCreationLimitAuth: 2,
      teamCreationWindowAuth: 60,
    });

    expect(await checkTeamCreationRateLimit("team-limit-user")).toBeNull();
    expect(await checkTeamCreationRateLimit("team-limit-user")).toBeNull();

    const limited = await checkTeamCreationRateLimit("team-limit-user");
    expect(limited?.retryAfter).toBeGreaterThan(0);
  });

  it("tracks users independently", async () => {
    mockGlobalSettings({
      teamCreationLimitAuth: 1,
      teamCreationWindowAuth: 60,
    });

    expect(await checkTeamCreationRateLimit("team-user-a")).toBeNull();
    expect(await checkTeamCreationRateLimit("team-user-b")).toBeNull();
    expect(await checkTeamCreationRateLimit("team-user-a")).not.toBeNull();
  });
});

describe("getClientIp", () => {
  it("uses the address resolved by SvelteKit", () => {
    expect(getClientIp({ getClientAddress: () => "203.0.113.50" })).toBe(
      "203.0.113.50",
    );
  });

  it("does not read spoofed X-Forwarded-For or X-Real-IP headers", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "6.6.6.6", "x-real-ip": "7.7.7.7" },
    });
    const event = {
      request,
      getClientAddress: () => "203.0.113.9",
    };
    expect(getClientIp(event)).toBe("203.0.113.9");
  });

  it("returns UNKNOWN_IP when the address cannot be determined", () => {
    expect(
      getClientIp({
        getClientAddress: () => {
          throw new Error("no address");
        },
      }),
    ).toBe(UNKNOWN_IP);
  });

  it("returns UNKNOWN_IP for malformed addresses", () => {
    expect(getClientIp({ getClientAddress: () => "not-an-ip" })).toBe(
      UNKNOWN_IP,
    );
  });

  it("unwraps IPv4-mapped IPv6 addresses", () => {
    expect(getClientIp({ getClientAddress: () => "::ffff:198.51.100.7" })).toBe(
      "198.51.100.7",
    );
  });

  it("collapses IPv6 addresses in the same /64 to one identity", () => {
    const a = getClientIp({ getClientAddress: () => "2001:db8:1:2::1" });
    const b = getClientIp({
      getClientAddress: () => "2001:db8:1:2:aaaa:bbbb:cccc:dddd",
    });
    const other = getClientIp({ getClientAddress: () => "2001:db8:1:3::1" });
    expect(a).toBe(b);
    expect(a).not.toBe(other);
  });

  it("spoofed headers cannot mint extra quota", () => {
    const config = { windowMs: 60_000, maxRequests: 1 };
    const spoof = (xff: string) => ({
      request: new Request("http://localhost", {
        headers: { "x-forwarded-for": xff },
      }),
      getClientAddress: () => "203.0.113.77",
    });

    const first = getClientIp(spoof("1.1.1.1"));
    expect(checkRateLimit(first, "/spoof", config)).toBeNull();
    const second = getClientIp(spoof("2.2.2.2"));
    expect(checkRateLimit(second, "/spoof", config)).not.toBeNull();
  });
});

describe("rate limit store cap", () => {
  beforeEach(() => resetRateLimitStore());
  afterEach(() => resetRateLimitStore());

  it("evicts the least recently used identities beyond the cap", () => {
    const config = { windowMs: 60_000, maxRequests: 1 };
    expect(checkRateLimit("victim", "/cap", config)).toBeNull();
    expect(checkRateLimit("victim", "/cap", config)).not.toBeNull();

    for (let i = 0; i < MAX_RATE_LIMIT_ENTRIES + 10; i++) {
      checkRateLimit(`flood-${i}`, "/cap", config);
    }

    expect(getRateLimitStoreSize()).toBeLessThanOrEqual(MAX_RATE_LIMIT_ENTRIES);
    // Evicted entry starts over, proving the store did not grow unbounded.
    expect(checkRateLimit("victim", "/cap", config)).toBeNull();
  });
});

describe("checkUserRateLimit", () => {
  beforeEach(() => resetRateLimitStore());

  it("returns 429 info with a positive retryAfter when over limit", () => {
    const limit = { limit: 2, windowMs: 60_000 };
    expect(checkUserRateLimit("u-1", "bucket", limit)).toBeNull();
    expect(checkUserRateLimit("u-1", "bucket", limit)).toBeNull();
    const limited = checkUserRateLimit("u-1", "bucket", limit);
    expect(limited?.retryAfter).toBeGreaterThan(0);
    expect(limited?.retryAfter).toBeLessThanOrEqual(60);
  });

  it("keys users separately from IPs", () => {
    const limit = { limit: 1, windowMs: 60_000 };
    expect(checkUserRateLimit("10.9.9.9", "bucket", limit)).toBeNull();
    // A user whose id equals an IP string does not share the IP's quota.
    expect(checkUserRateLimit({ ip: "10.9.9.9" }, "bucket", limit)).toBeNull();
    expect(checkUserRateLimit("10.9.9.9", "bucket", limit)).not.toBeNull();
    expect(
      checkUserRateLimit({ ip: "10.9.9.9" }, "bucket", limit),
    ).not.toBeNull();
  });

  it("tracks users independently", () => {
    const limit = { limit: 1, windowMs: 60_000 };
    expect(checkUserRateLimit("u-a", "bucket", limit)).toBeNull();
    expect(checkUserRateLimit("u-b", "bucket", limit)).toBeNull();
    expect(checkUserRateLimit("u-a", "bucket", limit)).not.toBeNull();
  });
});

describe("creation rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSettingsCache();
    resetDbChain();
    resetRateLimitStore();
  });

  it("reads counter and dashboard limits from global settings", async () => {
    mockGlobalSettings({
      counterCreationLimitAuth: 7,
      counterCreationWindowAuth: 30,
      counterCreationLimitUnauth: 3,
      counterCreationWindowUnauth: 90,
      dashboardCreationLimitAuth: 8,
      dashboardCreationWindowAuth: 45,
      dashboardCreationLimitUnauth: 4,
      dashboardCreationWindowUnauth: 120,
    });

    expect(await getCreationRateLimitConfig("counter", true)).toEqual({
      windowMs: 30_000,
      maxRequests: 7,
    });
    expect(await getCreationRateLimitConfig("counter", false)).toEqual({
      windowMs: 90_000,
      maxRequests: 3,
    });
    expect(await getCreationRateLimitConfig("dashboard", true)).toEqual({
      windowMs: 45_000,
      maxRequests: 8,
    });
    expect(await getCreationRateLimitConfig("dashboard", false)).toEqual({
      windowMs: 120_000,
      maxRequests: 4,
    });
  });

  it("enforces the configured limit per user", async () => {
    mockGlobalSettings({
      dashboardCreationLimitAuth: 2,
      dashboardCreationWindowAuth: 60,
    });
    const subject = { userId: "creator-1", ip: "203.0.113.1" };

    expect(await checkCreationRateLimit("dashboard", subject)).toBeNull();
    expect(await checkCreationRateLimit("dashboard", subject)).toBeNull();
    const limited = await checkCreationRateLimit("dashboard", subject);
    expect(limited?.retryAfter).toBeGreaterThan(0);
  });

  it("limits anonymous callers by IP with the unauthenticated settings", async () => {
    mockGlobalSettings({
      counterCreationLimitUnauth: 1,
      counterCreationWindowUnauth: 60,
    });

    expect(
      await checkCreationRateLimit("counter", { ip: "203.0.113.2" }),
    ).toBeNull();
    expect(
      await checkCreationRateLimit("counter", { ip: "203.0.113.2" }),
    ).not.toBeNull();
    expect(
      await checkCreationRateLimit("counter", { ip: "203.0.113.3" }),
    ).toBeNull();
  });

  it("keeps counter and dashboard quotas separate", async () => {
    mockGlobalSettings({
      counterCreationLimitAuth: 1,
      dashboardCreationLimitAuth: 1,
    });
    const subject = { userId: "creator-2", ip: "203.0.113.4" };

    expect(await checkCreationRateLimit("counter", subject)).toBeNull();
    expect(await checkCreationRateLimit("dashboard", subject)).toBeNull();
    expect(await checkCreationRateLimit("counter", subject)).not.toBeNull();
  });

  it("falls back to the default 5/min when settings cannot be read", async () => {
    mockDbWhere.mockRejectedValue(new Error("db down"));
    const subject = { userId: "creator-3", ip: "203.0.113.5" };

    for (let i = 0; i < 5; i++) {
      expect(await checkCreationRateLimit("counter", subject)).toBeNull();
    }
    expect(await checkCreationRateLimit("counter", subject)).not.toBeNull();
  });
});
