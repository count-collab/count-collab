import type { Handle, HandleServerError } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { verifyDatabaseConnection } from "$lib/db";
import { authHandle } from "$lib/server/auth";
import { logger } from "$lib/server/logger";
import { getUserRole } from "$lib/server/permissions";
import { getPostHogClient } from "$lib/server/posthog";
import type { RateLimitConfig } from "$lib/server/ratelimit";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitConfig,
  RATE_LIMIT_CONFIG,
  trackCounterIncrement,
} from "$lib/server/ratelimit";

const posthogProxyHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  if (pathname.startsWith("/ingest")) {
    const useAssetHost =
      pathname.startsWith("/ingest/static/") ||
      pathname.startsWith("/ingest/array/");
    const hostname = useAssetHost
      ? "eu-assets.i.posthog.com"
      : "eu.i.posthog.com";

    const url = new URL(event.request.url);
    url.protocol = "https:";
    url.hostname = hostname;
    url.port = "443";
    url.pathname = pathname.replace(/^\/ingest/, "");

    const headers = new Headers(event.request.headers);
    headers.set("host", hostname);
    headers.set("accept-encoding", "");

    const clientIp =
      event.request.headers.get("x-forwarded-for") || event.getClientAddress();
    if (clientIp) {
      headers.set("x-forwarded-for", clientIp);
    }

    const response = await fetch(url.toString(), {
      method: event.request.method,
      headers,
      body: event.request.body,
      // @ts-expect-error - duplex is required for streaming request bodies
      duplex: "half",
    });

    return response;
  }

  return resolve(event);
};

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
  if (pathname === "/api/counters") return "/api/counters";
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
      let isAuthenticated = false;
      if (writeRoute === "/api/counters/[id]") {
        const session = await event.locals.auth();
        if (session?.user?.id) {
          isAuthenticated = true;
          const role = await getUserRole(session.user.id);
          isAdmin = role === "admin";
        }
      }

      if (!isAdmin) {
        const clientIp = getClientIp(event.request);

        let config: RateLimitConfig | undefined;
        if (writeRoute === "/api/counters/[id]") {
          // Use DB-backed global settings for counter increments
          const dbConfig = await getRateLimitConfig(isAuthenticated);
          config = dbConfig.increment;
        } else {
          config =
            RATE_LIMIT_CONFIG[writeRoute as keyof typeof RATE_LIMIT_CONFIG];
        }

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
  posthogProxyHandle,
  noindexHandle,
  loggingHandle,
  authHandle,
  appHandle,
  usernameGuard,
);

export const handleError: HandleServerError = async ({
  error,
  message,
  status,
}) => {
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: "server",
    event: "server_error",
    properties: {
      error: error instanceof Error ? error.message : String(error),
      status,
      message,
    },
  });
  return { message, status };
};
