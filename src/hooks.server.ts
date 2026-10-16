import type { Handle, HandleServerError } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { verifyDatabaseConnection } from "$lib/db";
import { ipRateLimitHandle, userRateLimitHandle } from "$lib/server/api-rate-limit";
import { authHandle } from "$lib/server/auth";
import { logger } from "$lib/server/logger";
import { getPostHogClient } from "$lib/server/posthog";
import { posthogProxyHandle } from "$lib/server/posthog-proxy";
import { loggingHandle } from "$lib/server/request-logging";
import { securityHeadersHandle } from "$lib/server/security-headers";

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

const noindex = process.env.NOINDEX === "true";

const noindexHandle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (noindex) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
};

const dbInitHandle: Handle = async ({ event, resolve }) => {
  if (!dbInitialized) {
    await initializeDatabase();
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
      // Returned (not thrown) so outer handles still decorate the response.
      return new Response(null, {
        status: 303,
        headers: { Location: "/setup" },
      });
    }
  }

  return resolve(event);
};

export const handle: Handle = sequence(
  securityHeadersHandle,
  posthogProxyHandle,
  ipRateLimitHandle,
  noindexHandle,
  loggingHandle,
  authHandle,
  dbInitHandle,
  userRateLimitHandle,
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
      // Raw messages can embed URLs with share tokens, so only the error class is sent.
      error: error instanceof Error ? error.name : "UnknownError",
      status,
      message,
    },
  });
  return { message, status };
};
