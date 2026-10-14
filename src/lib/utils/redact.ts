// Share/join tokens and OAuth params must never reach logs or analytics.
const SENSITIVE_PARAM = /(^|[?&#;])([\w.-]*token[\w.-]*|code|state)=([^&#]*)/gi;

export const REDACTED = "[redacted]";

/** Replace the value of token-like query/fragment params in a URL, query string or referrer. */
export function redactUrl(value: string): string {
  return value.replace(SENSITIVE_PARAM, `$1$2=${REDACTED}`);
}

/** Same as `redactUrl`; returns undefined for an empty query string. */
export function redactSearch(search: string): string | undefined {
  return search ? redactUrl(search) : undefined;
}

const URL_LIKE_KEY = /url|referrer|referring_domain|pathname/i;

type PropertyBag = Record<string, unknown>;

function scrubBag(bag: unknown): void {
  if (!bag || typeof bag !== "object") return;
  const target = bag as PropertyBag;
  for (const [key, value] of Object.entries(target)) {
    if (typeof value === "string" && URL_LIKE_KEY.test(key)) {
      target[key] = redactUrl(value);
    }
  }
}

interface CaptureLike {
  properties?: PropertyBag;
  $set?: PropertyBag;
  $set_once?: PropertyBag;
}

/** PostHog `before_send` hook: strips token params from URL/referrer properties and exception messages. */
export function sanitizeCaptureResult<T extends CaptureLike>(
  event: T | null,
): T | null {
  if (!event) return event;

  for (const bag of [event.properties, event.$set, event.$set_once]) {
    scrubBag(bag);
  }

  const exceptions = event.properties?.$exception_list;
  if (Array.isArray(exceptions)) {
    for (const item of exceptions) {
      if (item && typeof item.value === "string") {
        item.value = redactUrl(item.value);
      }
    }
  }

  return event;
}
