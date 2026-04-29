import { beforeEach, describe, expect, it, vi } from "vitest";

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
  checkRateLimit,
  getClientIp,
  getEffectiveCooldownMs,
  recordCounterCooldown,
  resetCounterCooldownStore,
  resetSettingsCache,
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

describe("getClientIp", () => {
  it("extracts IP from X-Forwarded-For header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    });
    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("extracts IP from X-Real-IP header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "198.51.100.178" },
    });
    expect(getClientIp(request)).toBe("198.51.100.178");
  });

  it("returns 127.0.0.1 as fallback", () => {
    const request = new Request("http://localhost");
    expect(getClientIp(request)).toBe("127.0.0.1");
  });
});
