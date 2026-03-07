import { sequence } from "@sveltejs/kit/hooks";
import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { verifyDatabaseConnection } from "$lib/db";
import { logger } from "$lib/server/logger";
import { authHandle } from "$lib/server/auth";
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
  if (pathname.match(/^\/c\/[a-f0-9-]+$/)) return "/c/[id]";
  return null;
}

const appHandle: Handle = async ({ event, resolve }) => {
  if (!dbInitialized) {
    await initializeDatabase();
  }

  const start = performance.now();
  const { method, url } = event.request;
  const route = event.route.id ?? url;

  logger.info(`--> ${method} ${event.url.pathname}`, {
    route,
    query: event.url.search || undefined,
  });

  // Check rate limiting for write operations
  if (method === "POST") {
    const writeRoute = isWriteRoute(event.url.pathname);
    if (writeRoute) {
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

          const response = new Response(
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

          const duration = (performance.now() - start).toFixed(2);
          logger.warn(
            `<-- ${method} ${event.url.pathname} 429 (rate limited)`,
            {
              route,
              durationMs: duration,
              ip: clientIp,
            },
          );

          return response;
        }

        // Track counter increments for abuse detection
        if (writeRoute === "/c/[id]") {
          const match = event.url.pathname.match(/^\/c\/([a-f0-9-]+)$/);
          if (match) {
            trackCounterIncrement(clientIp, match[1]);
          }
        }
      }
    }
  }

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

export const handle: Handle = sequence(authHandle, appHandle, usernameGuard);
