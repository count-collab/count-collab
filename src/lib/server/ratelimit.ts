import { eq } from "drizzle-orm";
import { db } from "$lib/db";
import { type GlobalSettings, globalSettings } from "$lib/db/schema";
import { canEditCounter } from "$lib/server/authorize";
import { getUserRole } from "$lib/server/permissions";
import { logger } from "./logger";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RequestRecord {
  timestamps: number[];
}

interface IPRecord {
  [route: string]: RequestRecord;
}

const ipStore = new Map<string, IPRecord>();
const counterAbuseStore = new Map<string, Record<string, number>>();
const counterCooldownStore = new Map<string, number>(); // counterId → last increment timestamp (ms)

// Fallback defaults (kept for backward compatibility)
export const RATE_LIMIT_CONFIG = {
  "/api/counters": {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 5,
  },
  "/api/counters/[id]": {
    windowMs: 5 * 1000,
    maxRequests: 1, // 1 increment per 5 seconds
  },
};

// Fallback defaults (kept for backward compatibility)
export const RATE_LIMIT_CONFIG_UNAUTHENTICATED = {
  "/api/counters/[id]": {
    windowMs: 30 * 1000,
    maxRequests: 1, // 1 increment per 30 seconds for anonymous users
  },
};

// ── Global settings cache ────────────────────────────────────────

let cachedSettings: GlobalSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/** Reset the settings cache — used in tests */
export function resetSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

const DEFAULT_SETTINGS: Omit<GlobalSettings, "id" | "updatedAt"> = {
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
};

/**
 * Get global settings from the database with 60s in-memory cache.
 * Inserts the default row if none exists.
 */
export async function getGlobalSettings(): Promise<GlobalSettings> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const [row] = await db
    .select()
    .from(globalSettings)
    .where(eq(globalSettings.id, 1));

  if (row) {
    cachedSettings = row;
    cacheTimestamp = now;
    return row;
  }

  // Insert default row
  const [inserted] = await db
    .insert(globalSettings)
    .values({ id: 1, ...DEFAULT_SETTINGS })
    .returning();

  cachedSettings = inserted;
  cacheTimestamp = now;
  return inserted;
}

/**
 * Get rate limit configuration from global settings.
 */
export async function getRateLimitConfig(isAuthenticated: boolean): Promise<{
  creation: RateLimitConfig;
  increment: RateLimitConfig;
}> {
  const settings = await getGlobalSettings();

  if (isAuthenticated) {
    return {
      creation: {
        windowMs: settings.counterCreationWindowAuth * 1000,
        maxRequests: settings.counterCreationLimitAuth,
      },
      increment: {
        windowMs: settings.incrementCooldownMsAuth,
        maxRequests: 1,
      },
    };
  }

  return {
    creation: {
      windowMs: settings.counterCreationWindowUnauth * 1000,
      maxRequests: settings.counterCreationLimitUnauth,
    },
    increment: {
      windowMs: settings.incrementCooldownMsUnauth,
      maxRequests: 1,
    },
  };
}

/**
 * Compute the effective cooldown for a counter increment.
 * Takes into account global settings, per-counter cooldown, and user exemptions.
 */
export async function getEffectiveCooldownMs(
  counterId: string,
  userId: string | undefined,
  counter: {
    cooldownEnabled: boolean;
    cooldownSeconds: number;
    ownerId: string | null;
  },
): Promise<number> {
  // Site admins are exempt from all cooldowns
  if (userId) {
    const role = await getUserRole(userId);
    if (role === "admin") return 0;
  }

  const settings = await getGlobalSettings();
  const globalCooldown = userId
    ? settings.incrementCooldownMsAuth
    : settings.incrementCooldownMsUnauth;

  if (!counter.cooldownEnabled) {
    return globalCooldown;
  }

  // Counter-specific cooldown doesn't apply to owners/editors
  if (userId) {
    const isEditor = await canEditCounter(userId, counterId);
    if (isEditor) {
      return globalCooldown;
    }
  }

  const counterCooldownMs = counter.cooldownSeconds * 1000;
  return Math.max(globalCooldown, counterCooldownMs);
}

/**
 * Record a counter-wide cooldown after a successful increment.
 */
export function recordCounterCooldown(counterId: string): void {
  counterCooldownStore.set(counterId, Date.now());
}

/**
 * Reset the counter cooldown store — used in tests.
 */
export function resetCounterCooldownStore(): void {
  counterCooldownStore.clear();
}

/**
 * Check if the counter-wide cooldown is active for a given user.
 * Returns { blocked: false, cooldownSeconds } when the user can increment,
 * or { blocked: true, retryAfterSeconds } when the cooldown is active.
 */
export async function checkCounterCooldown(
  counterId: string,
  userId: string | undefined,
  counter: {
    cooldownEnabled: boolean;
    cooldownSeconds: number;
    ownerId: string | null;
  },
): Promise<
  | { blocked: true; retryAfterSeconds: number }
  | { blocked: false; cooldownSeconds: number }
> {
  // Site admins are exempt from all cooldowns
  if (userId) {
    const role = await getUserRole(userId);
    if (role === "admin") return { blocked: false, cooldownSeconds: 0 };
  }

  const settings = await getGlobalSettings();
  const globalCooldownMs = userId
    ? settings.incrementCooldownMsAuth
    : settings.incrementCooldownMsUnauth;
  const globalCooldownSec = Math.ceil(globalCooldownMs / 1000);

  // Owners/editors are never blocked by counter cooldown
  if (userId) {
    const isEditor = await canEditCounter(userId, counterId);
    if (isEditor) {
      return { blocked: false, cooldownSeconds: globalCooldownSec };
    }
  }

  if (!counter.cooldownEnabled) {
    return { blocked: false, cooldownSeconds: globalCooldownSec };
  }

  const counterCooldownMs = counter.cooldownSeconds * 1000;
  const effectiveCooldownMs = Math.max(globalCooldownMs, counterCooldownMs);
  const effectiveCooldownSec = Math.ceil(effectiveCooldownMs / 1000);

  const lastIncrement = counterCooldownStore.get(counterId);
  if (lastIncrement !== undefined) {
    const elapsed = Date.now() - lastIncrement;
    if (elapsed < effectiveCooldownMs) {
      const remainingMs = effectiveCooldownMs - elapsed;
      return {
        blocked: true,
        retryAfterSeconds: Math.ceil(remainingMs / 1000),
      };
    }
  }

  return { blocked: false, cooldownSeconds: effectiveCooldownSec };
}

/**
 * Get IP address from request, handling X-Forwarded-For headers
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp;
  }

  // Fallback for local connections
  return "127.0.0.1";
}

/**
 * Check if IP is rate limited for a given route using sliding window algorithm.
 * Returns null if request is allowed, or object with retry info if limited.
 */
export function checkRateLimit(
  ip: string,
  route: string,
  config: RateLimitConfig,
): { retryAfter: number } | null {
  const now = Date.now();
  const routeKey = route;
  const windowStart = now - config.windowMs;

  // Initialize IP record if needed
  if (!ipStore.has(ip)) {
    ipStore.set(ip, {});
  }

  const ipRecord = ipStore.get(ip);
  if (!ipRecord) {
    return null;
  }

  // Initialize route record if needed
  if (!ipRecord[routeKey]) {
    ipRecord[routeKey] = {
      timestamps: [],
    };
  }

  const record = ipRecord[routeKey];

  // Remove timestamps outside the sliding window
  record.timestamps = record.timestamps.filter(
    (timestamp) => timestamp > windowStart,
  );

  // Check if over limit
  if (record.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const retryAfterMs = oldestTimestamp + config.windowMs - now;
    const retryAfter = Math.ceil(retryAfterMs / 1000);

    logger.warn("Rate limit exceeded", {
      ip,
      route,
      count: record.timestamps.length,
      limit: config.maxRequests,
      retryAfter,
    });

    return { retryAfter };
  }

  // Add current timestamp
  record.timestamps.push(now);
  return null;
}

/**
 * Track counter increments for abuse detection
 */
export function trackCounterIncrement(ip: string, counterId: string): void {
  if (!counterAbuseStore.has(ip)) {
    counterAbuseStore.set(ip, {});
  }

  const ipCounters = counterAbuseStore.get(ip);
  if (!ipCounters) {
    return;
  }

  ipCounters[counterId] = (ipCounters[counterId] ?? 0) + 1;

  // Check for abuse pattern (many increments to same counter)
  if (ipCounters[counterId] > 20) {
    logger.warn("Abuse signal: Rapid counter increments detected", {
      ip,
      counterId,
      incrementCount: ipCounters[counterId],
    });
  }
}

/**
 * Cleanup old records periodically to prevent memory leak
 */
export function cleanupOldRecords(): void {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  // Cleanup IP store
  for (const [ip, routes] of ipStore.entries()) {
    let hasActiveRoute = false;

    for (const [route, record] of Object.entries(routes)) {
      // Remove timestamps older than maxAge
      record.timestamps = record.timestamps.filter(
        (timestamp) => now - timestamp < maxAge,
      );

      // Keep route if it has recent activity
      if (record.timestamps.length > 0) {
        hasActiveRoute = true;
      } else {
        delete routes[route];
      }
    }

    if (!hasActiveRoute) {
      ipStore.delete(ip);
    }
  }

  // Cleanup counter abuse store
  for (const [ip] of counterAbuseStore.entries()) {
    if (!ipStore.has(ip)) {
      counterAbuseStore.delete(ip);
    }
  }

  // Cleanup counter cooldown store (remove entries older than 5 minutes)
  for (const [counterId, timestamp] of counterCooldownStore.entries()) {
    if (now - timestamp > maxAge) {
      counterCooldownStore.delete(counterId);
    }
  }

  logger.debug("Rate limiter: Cleaned up old records", {
    activeIPs: ipStore.size,
  });
}

// Schedule cleanup every 5 minutes
setInterval(cleanupOldRecords, 5 * 60 * 1000);
