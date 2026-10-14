import { and, eq, gt } from "drizzle-orm";
import { db } from "$lib/db";
import { sessions } from "$lib/db/schema";

// Auth.js uses the secure-prefixed name when the site is served over HTTPS
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

const MAX_TOKEN_LENGTH = 256;

export function readSessionTokens(cookieHeader: string | undefined): string[] {
  if (!cookieHeader) return [];

  const found = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const sep = part.indexOf("=");
    if (sep === -1) continue;
    const name = part.slice(0, sep).trim();
    if (!SESSION_COOKIE_NAMES.includes(name) || found.has(name)) continue;

    let value = part.slice(sep + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      continue;
    }
    if (value && value.length <= MAX_TOKEN_LENGTH) found.set(name, value);
  }

  return SESSION_COOKIE_NAMES.flatMap((name) => found.get(name) ?? []);
}

/**
 * Resolve the signed-in user id from the Auth.js database session cookie.
 * Returns null for anonymous or expired sessions; throws if the lookup itself fails.
 */
export async function resolveSessionUserId(
  cookieHeader: string | undefined,
): Promise<string | null> {
  for (const token of readSessionTokens(cookieHeader)) {
    const [row] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(
        and(eq(sessions.sessionToken, token), gt(sessions.expires, new Date())),
      )
      .limit(1);
    if (row) return row.userId;
  }
  return null;
}
