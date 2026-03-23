import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { verifyDatabaseConnection } from "$lib/db";
import { authHandle } from "$lib/server/auth";
import { logger } from "$lib/server/logger";
import { getUserRole } from "$lib/server/permissions";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIG,
  trackCounterIncrement,
} from "$lib/server/ratelimit";

let dbInitialized = false;

async function initializeDatabase() {
  if (dbInitialized) return;
  dbInitialized = true;

  logger.info("Verifying database connection...");
  const isConnected = await verifyDatabaseConnection();

  if (!isConnected) {
    logger.error(
      "Failed to connect to database. Please ensure PostgreSQL is running and DATABASE_URL is correctly configured.",
    );
    throw new Error("Database connection failed");
  } else {
    logger.info("Database connection verified");
  }
}

function isWriteRoute(pathname: string): string | null {
  if (pathname === "/create") return "/create";
  if (pathname.match(/^\/api\/counters\/[a-f0-9-]+$/))
    return "/api/counters/[id]";
  return null;
}

const noindex = process.env.NOINDEX === "true";

const noindexHandle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (noindex) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
};

const loggingHandle: Handle = async ({ event, resolve }) => {
  const start = performance.now();
  const { method } = event.request;
  const route = event.route.id ?? event.request.url;

  logger.info(`--> ${method} ${event.url.pathname}`, {
    route,
    query: event.url.search || undefined,
  });

  try {
    const response = await resolve(event);
    const duration = (performance.now() - start).toFixed(2);

    const level =
      response.status >= 500
        ? "error"
        : response.status >= 400
          ? "warn"
          : "info";

    logger[level](`<-- ${method} ${event.url.pathname} ${response.status}`, {
      route,
      status: response.status,
      durationMs: duration,
    });

    return response;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);

    logger.error(`<-- ${method} ${event.url.pathname} UNHANDLED`, {
      route,
      durationMs: duration,
      error: err instanceof Error ? err.message : String(err),
    });

    throw err;
  }
};

const appHandle: Handle = async ({ event, resolve }) => {
  if (!dbInitialized) {
    await initializeDatabase();
  }

  // Check rate limiting for write operations
  if (event.request.method === "POST") {
    const writeRoute = isWriteRoute(event.url.pathname);
    if (writeRoute) {
      // Skip rate limiting for admin users
      let isAdmin = false;
      if (writeRoute === "/api/counters/[id]") {
        const session = await event.locals.auth();
        if (session?.user?.id) {
          const role = await getUserRole(session.user.id);
          isAdmin = role === "admin";
        }
      }

      if (!isAdmin) {
        const clientIp = getClientIp(event.request);
        const config =
          RATE_LIMIT_CONFIG[writeRoute as keyof typeof RATE_LIMIT_CONFIG];

        if (config) {
          const rateLimitCheck = checkRateLimit(clientIp, writeRoute, config);

          if (rateLimitCheck) {
            logger.warn("Rate limit exceeded, returning 429", {
              ip: clientIp,
              route: writeRoute,
              retryAfter: rateLimitCheck.retryAfter,
            });

            return new Response(
              JSON.stringify({
                error: "Too many requests",
                retryAfterSeconds: rateLimitCheck.retryAfter,
              }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": String(rateLimitCheck.retryAfter),
                },
              },
            );
          }

          // Track counter increments for abuse detection
          if (writeRoute === "/api/counters/[id]") {
            const match = event.url.pathname.match(
              /^\/api\/counters\/([a-f0-9-]+)$/,
            );
            if (match) {
              trackCounterIncrement(clientIp, match[1]);
            }
          }
        }
      }
    }
  }

  return resolve(event);
};

const USERNAME_SKIP_PREFIXES = [
  "/setup",
  "/api/auth",
  "/_app",
  "/favicon",
  "/health",
];

const usernameGuard: Handle = async ({ event, resolve }) => {
  const session = await event.locals.auth();

  if (session?.user) {
    // Redirect authenticated users without a username to /setup
    const needsSetup = !session.user.username;
    const isSkipped = USERNAME_SKIP_PREFIXES.some((p) =>
      event.url.pathname.startsWith(p),
    );

    if (needsSetup && !isSkipped) {
      throw redirect(303, "/setup");
    }
  }

  return resolve(event);
};

export const handle: Handle = sequence(
  noindexHandle,
  loggingHandle,
  authHandle,
  appHandle,
  usernameGuard,
);
