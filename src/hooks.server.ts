import type { Handle } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";
import { verifyDatabaseConnection } from "$lib/db";

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


export const handle: Handle = async ({ event, resolve }) => {
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
