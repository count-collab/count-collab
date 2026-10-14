import type { Handle, RequestEvent } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/db";
import { counters } from "$lib/db/schema";
import { logger } from "$lib/server/logger";
import { getUserRole } from "$lib/server/permissions";
import {
  type BucketLimit,
  type CreationKind,
  checkCreationRateLimit,
  checkRateLimit,
  checkUserRateLimit,
  getClientIp,
  getRateLimitConfig,
  RATE_LIMIT_CONFIG_UNAUTHENTICATED,
  trackCounterIncrement,
} from "$lib/server/ratelimit";

const MINUTE = 60_000;
const perMinute = (limit: number): BucketLimit => ({
  limit,
  windowMs: MINUTE,
});

export const API_LIMITS = {
  /** Any non-GET request except counter increments. */
  mutatingPerIp: perMinute(120),
  mutatingPerUser: perMinute(120),
  /** GET /api/** */
  readPerIp: perMinute(600),
  /** Ceiling above the 100 ms private-counter debounce; the cooldown limiter does the real work. */
  incrementFloodPerIp: perMinute(1200),
} as const;

interface ThrottleRule {
  name: string;
  methods: readonly string[];
  pattern: RegExp;
  ip: BucketLimit;
  user?: BucketLimit;
}

/** Tighter limits for expensive or abusable endpoints; added on top of the generic limits. */
export const THROTTLE_RULES: readonly ThrottleRule[] = [
  { name: "og", methods: ["GET", "HEAD"], pattern: /^\/api\/og\//, ip: perMinute(60) },
  {
    name: "username-check",
    methods: ["GET"],
    pattern: /^\/api\/username\/check$/,
    ip: perMinute(30),
  },
  {
    name: "search",
    methods: ["GET"],
    pattern: /^\/api\/(?:.+\/)?search(?:-[a-z]+)?$/,
    ip: perMinute(60),
    user: perMinute(60),
  },
  {
    name: "sitemap",
    methods: ["GET"],
    pattern: /^\/sitemap(?:_alt)?\.xml$/,
    ip: perMinute(10),
  },
  {
    name: "invite",
    methods: ["POST"],
    pattern: /^\/(?:c|d|t)\/[^/]+\/members$/,
    ip: perMinute(30),
    user: perMinute(20),
  },
  {
    name: "invite",
    methods: ["PATCH"],
    pattern: /^\/(?:c|d|t)\/[^/]+\/invitations\/[^/]+$/,
    ip: perMinute(30),
    user: perMinute(20),
  },
  {
    name: "follow",
    methods: ["POST", "DELETE"],
    pattern: /^\/api\/(?:counters|dashboards)\/[^/]+\/follow$/,
    ip: perMinute(60),
    user: perMinute(30),
  },
  {
    name: "goal-create",
    methods: ["POST"],
    pattern: /^\/api\/counters\/[^/]+\/goals$/,
    ip: perMinute(30),
    user: perMinute(20),
  },
  {
    name: "team-join",
    methods: ["POST"],
    pattern: /^\/api\/teams\/[^/]+\/join$/,
    ip: perMinute(10),
    user: perMinute(10),
  },
  {
    name: "team-join-page",
    methods: ["GET"],
    pattern: /^\/t\/[^/]+\/join$/,
    ip: perMinute(30),
  },
  {
    name: "transfer",
    methods: ["POST"],
    pattern: /^\/api\/(?:counters|dashboards)\/[^/]+\/transfer$/,
    ip: perMinute(20),
    user: perMinute(10),
  },
  {
    name: "join-link",
    methods: ["POST", "PATCH", "DELETE"],
    pattern: /^\/api\/teams\/[^/]+\/join-link$/,
    ip: perMinute(20),
    user: perMinute(10),
  },
];

const CREATION_PATHS: Record<string, CreationKind> = {
  "/api/counters": "counter",
  "/api/dashboards": "dashboard",
};

const INCREMENT_PATH = /^\/api\/counters\/([0-9a-f-]+)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Mirrors SvelteKit's route matching so encoded or slash-padded paths cannot dodge the rules.
function normalizePath(pathname: string): string {
  let path: string;
  try {
    path = pathname.split("%25").map(decodeURI).join("%25");
  } catch {
    path = pathname;
  }
  path = path.replace(/\/{2,}/g, "/");
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function classify(event: RequestEvent) {
  const method = event.request.method.toUpperCase();
  const path = normalizePath(event.url.pathname);
  const exempt =
    path === "/health" ||
    path === "/ingest" ||
    path.startsWith("/ingest/") ||
    path.startsWith("/_app/");
  const incrementId =
    method === "POST" ? INCREMENT_PATH.exec(path)?.[1].toLowerCase() : undefined;

  return {
    exempt,
    isSafe: SAFE_METHODS.has(method),
    isApi: path.startsWith("/api/"),
    incrementId,
    creationKind: method === "POST" ? CREATION_PATHS[path] : undefined,
    rule: THROTTLE_RULES.find(
      (r) => r.methods.includes(method) && r.pattern.test(path),
    ),
  };
}

function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfterSeconds: retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

/** Per-IP limits that need no session; runs before authentication so Auth.js routes are covered too. */
export const ipRateLimitHandle: Handle = async ({ event, resolve }) => {
  const req = classify(event);
  if (req.exempt) return resolve(event);

  const checks: [string, BucketLimit][] = [];
  if (req.incrementId) {
    checks.push(["increment:flood", API_LIMITS.incrementFloodPerIp]);
  } else if (!req.isSafe) {
    checks.push(["generic:mutating", API_LIMITS.mutatingPerIp]);
  } else if (req.isApi) {
    checks.push(["generic:read", API_LIMITS.readPerIp]);
  }
  if (req.rule) checks.push([`rule:${req.rule.name}`, req.rule.ip]);
  if (checks.length === 0) return resolve(event);

  const ip = getClientIp(event);
  for (const [bucket, limit] of checks) {
    const limited = checkUserRateLimit({ ip }, bucket, limit);
    if (limited) return tooManyRequests(limited.retryAfter);
  }

  return resolve(event);
};

/** Counters in private mode are exempt from the global IP cooldown; everything else, including unknown ids, is not. */
async function isPrivateCounter(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;

  try {
    const [counter] = await db
      .select({ visibilityMode: counters.visibilityMode })
      .from(counters)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
      .where(eq(counters.id, id as any));
    return counter?.visibilityMode === "private";
  } catch (err) {
    logger.warn("Unable to resolve counter visibility for rate-limit routing", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function incrementCooldownConfig(isAuthenticated: boolean) {
  try {
    return (await getRateLimitConfig(isAuthenticated)).increment;
  } catch (err) {
    logger.warn("Unable to read increment limits, using defaults", {
      error: err instanceof Error ? err.message : String(err),
    });
    return RATE_LIMIT_CONFIG_UNAUTHENTICATED["/api/counters/[id]"];
  }
}

async function checkIncrement(
  counterId: string,
  ip: string,
  userId: string | undefined,
) {
  if (userId && (await getUserRole(userId)) === "admin") return null;
  if (await isPrivateCounter(counterId)) return null;

  const limited = checkRateLimit(
    ip,
    "/api/counters/[id]",
    await incrementCooldownConfig(!!userId),
  );
  if (!limited) trackCounterIncrement(ip, counterId);
  return limited;
}

/** Limits that depend on who is calling: increment cooldowns, creation quotas and per-user budgets. */
export const userRateLimitHandle: Handle = async ({ event, resolve }) => {
  const req = classify(event);
  const needsSession =
    !req.exempt &&
    Boolean(
      req.incrementId || req.creationKind || !req.isSafe || req.rule?.user,
    );
  if (!needsSession) return resolve(event);

  const ip = getClientIp(event);
  const session = await event.locals.auth();
  const userId = session?.user?.id;

  let limited: { retryAfter: number } | null = null;
  if (req.incrementId) {
    limited = await checkIncrement(req.incrementId, ip, userId);
  } else {
    if (req.creationKind) {
      limited = await checkCreationRateLimit(req.creationKind, { userId, ip });
    }
    if (!limited && userId && !req.isSafe) {
      limited = checkUserRateLimit(
        userId,
        "generic:mutating",
        API_LIMITS.mutatingPerUser,
      );
    }
    if (!limited && userId && req.rule?.user) {
      limited = checkUserRateLimit(
        userId,
        `rule:${req.rule.name}`,
        req.rule.user,
      );
    }
  }

  if (limited) {
    logger.warn("Rate limit exceeded, returning 429", {
      retryAfter: limited.retryAfter,
    });
    return tooManyRequests(limited.retryAfter);
  }

  return resolve(event);
};
