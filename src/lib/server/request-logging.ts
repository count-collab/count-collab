import type { Handle } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";
import { redactSearch, redactUrl } from "$lib/utils/redact";

export const loggingHandle: Handle = async ({ event, resolve }) => {
  const start = performance.now();
  const { method } = event.request;
  const route = event.route.id ?? event.url.pathname;

  logger.info(`--> ${method} ${event.url.pathname}`, {
    route,
    query: redactSearch(event.url.search),
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
      error: redactUrl(err instanceof Error ? err.message : String(err)),
    });

    throw err;
  }
};
