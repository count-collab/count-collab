import type { Handle } from "@sveltejs/kit";
import { checkUserRateLimit, getClientIp } from "$lib/server/ratelimit";

export const INGEST_MAX_BODY_BYTES = 1024 * 1024;
export const INGEST_RATE_LIMIT = { limit: 300, windowMs: 60_000 };
const UPSTREAM_TIMEOUT_MS = 10_000;

const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);
const FORWARDED_REQUEST_HEADERS = [
  "content-type",
  "content-encoding",
  "accept",
  "user-agent",
];
// Only encodings fetch() decodes transparently, so the relayed body stays valid.
const DECODABLE_ENCODINGS = new Set(["gzip", "deflate", "br"]);
// fetch() already decoded the body, so upstream framing headers no longer apply.
const DROPPED_RESPONSE_HEADERS = [
  "set-cookie",
  "set-cookie2",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
];

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

/** Reads at most `max` bytes; returns null when the body is larger. */
async function readBodyLimited(
  request: Request,
  max: number,
): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export const posthogProxyHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  if (pathname !== "/ingest" && !pathname.startsWith("/ingest/")) {
    return resolve(event);
  }

  const method = event.request.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return json({ error: "Method not allowed" }, 405, {
      Allow: "GET, POST, OPTIONS",
    });
  }

  const clientIp = getClientIp(event);
  const limited = checkUserRateLimit({ ip: clientIp }, "/ingest", INGEST_RATE_LIMIT);
  if (limited) {
    return json(
      { error: "Too many requests", retryAfterSeconds: limited.retryAfter },
      429,
      { "Retry-After": String(limited.retryAfter) },
    );
  }

  let body: Uint8Array | undefined;
  if (method === "POST") {
    const read = await readBodyLimited(event.request, INGEST_MAX_BODY_BYTES);
    if (read === null) return json({ error: "Payload too large" }, 413);
    body = read;
  }

  const useAssetHost =
    pathname.startsWith("/ingest/static/") ||
    pathname.startsWith("/ingest/array/");
  const url = new URL(event.url);
  url.protocol = "https:";
  url.hostname = useAssetHost ? "eu-assets.i.posthog.com" : "eu.i.posthog.com";
  url.port = "443";
  url.pathname = pathname.replace(/^\/ingest/, "") || "/";

  // Allowlist only: cookies, authorization, origin and referer must not leave the server.
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = event.request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const encodings = (event.request.headers.get("accept-encoding") ?? "")
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .filter((encoding) => DECODABLE_ENCODINGS.has(encoding));
  headers.set("accept-encoding", encodings.join(", ") || "identity");
  try {
    headers.set("x-forwarded-for", event.getClientAddress());
  } catch {
    // Address unavailable behind a misconfigured proxy; PostHog falls back to the socket.
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: body as BodyInit | undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json({ error: "Upstream unavailable" }, 502);
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) responseHeaders.delete(name);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
};
