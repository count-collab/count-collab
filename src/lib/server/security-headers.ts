import type { Handle } from "@sveltejs/kit";

export const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
export const HSTS_VALUE = "max-age=31536000; includeSubDomains";

const SHARE_PAGE = /^\/(c|d|t)\/[^/]+/;
const TEAM_JOIN_PAGE = /^\/t\/[^/]+\/join\/?$/;

/** Share and join links carry secrets in `?token=`; keep them out of outgoing Referer headers. */
function referrerPolicyFor(pathname: string, search: URLSearchParams): string {
  const isSecretLink =
    TEAM_JOIN_PAGE.test(pathname) ||
    (SHARE_PAGE.test(pathname) && search.has("token"));
  return isSecretLink ? "no-referrer" : "strict-origin-when-cross-origin";
}

/** Sets baseline security headers on every response; headers already present are kept. */
export const securityHeadersHandle: Handle = async ({ event, resolve }) => {
  let response = await resolve(event);

  const defaults: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": referrerPolicyFor(
      event.url.pathname,
      event.url.searchParams,
    ),
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (event.url.protocol === "https:") {
    defaults["Strict-Transport-Security"] = HSTS_VALUE;
  }

  const missing = Object.entries(defaults).filter(
    ([name]) => !response.headers.has(name),
  );

  try {
    for (const [name, value] of missing) response.headers.set(name, value);
  } catch {
    // Responses created by fetch() have immutable headers.
    const headers = new Headers(response.headers);
    for (const [name, value] of missing) headers.set(name, value);
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
};
