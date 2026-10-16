import { isIP } from "node:net";
import { eq } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { db } from "$lib/db";
import { type GlobalSettings, globalSettings } from "$lib/db/schema";
import { canEditCounter } from "$lib/server/authorize";
import { getUserRole } from "$lib/server/permissions";
import { logger } from "./logger";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

/** Limit expressed as "limit requests per windowMs". */
export interface BucketLimit {
  limit: number;
  windowMs: number;
}

interface RequestRecord {
  timestamps: number[];
  windowMs: number;
}

interface IPRecord {
  [route: string]: RequestRecord;
}

/** Bounds memory when identities are attacker-chosen; least recently used keys are evicted first. */
export const MAX_RATE_LIMIT_ENTRIES = 50_000;
const ipStore = new LRUCache<string, IPRecord>({
  max: MAX_RATE_LIMIT_ENTRIES,
});

/** Shared bucket for requests whose client address cannot be determined. */
export const UNKNOWN_IP = "unknown";
const counterAbuseStore = new Map<string, Record<string, number>>();
const counterCooldownStore = new Map<string, number>(); // counterId → last increment timestamp (ms)
export const PRIVATE_COUNTER_DEBOUNCE_MS = 100;

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
  teamCreationLimitAuth: 3,
  teamCreationWindowAuth: 60,
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

export type CreationKind = "counter" | "dashboard";

/**
 * Creation limit for counters or dashboards from the admin-editable global settings.
 */
export async function getCreationRateLimitConfig(
  kind: CreationKind,
  isAuthenticated: boolean,
): Promise<RateLimitConfig> {
  const s = await getGlobalSettings();
  if (kind === "counter") {
    return isAuthenticated
      ? {
          windowMs: s.counterCreationWindowAuth * 1000,
          maxRequests: s.counterCreationLimitAuth,
        }
      : {
          windowMs: s.counterCreationWindowUnauth * 1000,
          maxRequests: s.counterCreationLimitUnauth,
        };
  }
  return isAuthenticated
    ? {
        windowMs: s.dashboardCreationWindowAuth * 1000,
        maxRequests: s.dashboardCreationLimitAuth,
      }
    : {
        windowMs: s.dashboardCreationWindowUnauth * 1000,
        maxRequests: s.dashboardCreationLimitUnauth,
      };
}

/**
 * Enforce the configured creation limit. Signed-in callers are keyed by user,
 * anonymous callers by IP. Falls back to the hard-coded default if settings
 * cannot be read.
 */
export async function checkCreationRateLimit(
  kind: CreationKind,
  subject: { userId?: string | null; ip: string },
): Promise<{ retryAfter: number } | null> {
  let config: RateLimitConfig;
  try {
    config = await getCreationRateLimitConfig(kind, !!subject.userId);
  } catch (err) {
    logger.warn("Unable to read creation limits, using defaults", {
      error: err instanceof Error ? err.message : String(err),
    });
    config = RATE_LIMIT_CONFIG["/api/counters"];
  }

  return checkUserRateLimit(
    subject.userId ? subject.userId : { ip: subject.ip },
    kind === "counter" ? "/api/counters" : "/api/dashboards",
    { limit: config.maxRequests, windowMs: config.windowMs },
  );
}

/**
 * Get the team creation rate limit from global settings. Teams always require login.
 */
export async function getTeamCreationRateLimitConfig(): Promise<RateLimitConfig> {
  const settings = await getGlobalSettings();
  return {
    windowMs: settings.teamCreationWindowAuth * 1000,
    maxRequests: settings.teamCreationLimitAuth,
  };
}

/**
 * Check the team creation rate limit for a user.
 * Returns null if allowed, or retry info if limited.
 */
export async function checkTeamCreationRateLimit(
  userId: string,
): Promise<{ retryAfter: number } | null> {
  const config = await getTeamCreationRateLimitConfig();
  return checkUserRateLimit(userId, "/api/teams", {
    limit: config.maxRequests,
    windowMs: config.windowMs,
  });
}

/**
 * Sliding-window limit for a signed-in user (pass the user id) or an IP
 * (pass `{ ip }`) within a named bucket. Returns null if allowed.
 */
export function checkUserRateLimit(
  subject: string | { ip: string },
  bucket: string,
  { limit, windowMs }: BucketLimit,
): { retryAfter: number } | null {
  const key = typeof subject === "string" ? `user:${subject}` : subject.ip;
  return checkRateLimit(key, bucket, { windowMs, maxRequests: limit });
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
  counterCooldownStore.set(counterId.toLowerCase(), Date.now());
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

  const lastIncrement = counterCooldownStore.get(counterId.toLowerCase());
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
 * Check cooldown for private counters.
 *
 * Private counters bypass global IP cooldown and rely on:
 * - a 100ms debounce safeguard
 * - optional counter-specific cooldown when enabled
 */
export async function checkPrivateCounterCooldown(
  counterId: string,
  userId: string | undefined,
  counter: {
    cooldownEnabled: boolean;
    cooldownSeconds: number;
  },
): Promise<
  | { blocked: true; retryAfterSeconds: number }
  | { blocked: false; cooldownSeconds: number }
> {
  // Keep existing admin bypass behavior
  if (userId) {
    const role = await getUserRole(userId);
    if (role === "admin") return { blocked: false, cooldownSeconds: 0 };
  }

  const configuredCooldownMs = counter.cooldownEnabled
    ? counter.cooldownSeconds * 1000
    : 0;
  const effectiveCooldownMs = Math.max(
    PRIVATE_COUNTER_DEBOUNCE_MS,
    configuredCooldownMs,
  );

  const lastIncrement = counterCooldownStore.get(counterId.toLowerCase());
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

  if (!counter.cooldownEnabled) {
    return { blocked: false, cooldownSeconds: 0 };
  }

  return {
    blocked: false,
    cooldownSeconds: Math.ceil(effectiveCooldownMs / 1000),
  };
}

// Collapses IPv6 to its /64 so one subscriber cannot mint unlimited identities.
function normalizeIp(raw: string): string {
  const ip = raw.trim();
  const family = isIP(ip);
  if (family === 0) return UNKNOWN_IP;
  if (family === 4) return ip;

  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];

  const [head, tail] = ip.split("%")[0].split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? headParts
      : [
          ...headParts,
          ...Array(Math.max(0, 8 - headParts.length - tailParts.length)).fill("0"),
          ...tailParts,
        ];
  const prefix = groups.slice(0, 4).map((g) => Number.parseInt(g, 16));
  return `${prefix.map((g) => g.toString(16)).join(":")}::/64`;
}

/**
 * Client address as resolved by SvelteKit. adapter-node derives it from the socket,
 * or from ADDRESS_HEADER/XFF_DEPTH behind a trusted proxy; raw X-Forwarded-For is
 * never read here because clients can spoof it.
 */
export function getClientIp(event: { getClientAddress: () => string }): string {
  try {
    return normalizeIp(event.getClientAddress());
  } catch {
    return UNKNOWN_IP;
  }
}

/** Number of identities currently tracked — used in tests. */
export function getRateLimitStoreSize(): number {
  return ipStore.size;
}

/** Clear all rate limit state — used in tests. */
export function resetRateLimitStore(): void {
  ipStore.clear();
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

  let ipRecord = ipStore.get(ip);
  if (!ipRecord) {
    ipRecord = {};
    ipStore.set(ip, ipRecord);
  }

  if (!ipRecord[routeKey]) {
    ipRecord[routeKey] = {
      timestamps: [],
      windowMs: config.windowMs,
    };
  }

  const record = ipRecord[routeKey];
  record.windowMs = config.windowMs;

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
  for (const [ip, routes] of [...ipStore.entries()]) {
    let hasActiveRoute = false;

    for (const [route, record] of Object.entries(routes)) {
      // Keep timestamps for as long as their own window needs them
      const keepFor = Math.max(record.windowMs, maxAge);
      record.timestamps = record.timestamps.filter(
        (timestamp) => now - timestamp < keepFor,
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
