import { type SQL, sql } from "drizzle-orm";
import { users } from "$lib/db/schema";

export const USER_NAME_METADATA_KEY = "user_name";

const STORED_USERNAME_RE = /^[a-z0-9_]{3,30}$/;

/**
 * Historic events may hold the OAuth full name in metadata.user_name; only ever expose a username.
 */
export function sanitizeEventMetadata(
  eventType: string,
  metadata: Record<string, unknown> | null,
  actorUsername: string | null,
): Record<string, unknown> | null {
  if (!metadata || metadata[USER_NAME_METADATA_KEY] == null) return metadata;

  let userName: string | null;
  if (eventType === "user_deleted") {
    // Subject is the deleted user, not the actor, so it can't be re-joined
    const stored = metadata[USER_NAME_METADATA_KEY];
    userName =
      typeof stored === "string" && STORED_USERNAME_RE.test(stored)
        ? stored
        : null;
  } else {
    userName = actorUsername;
  }

  return { ...metadata, [USER_NAME_METADATA_KEY]: userName };
}

/** Restricts metadata.user_name values to existing usernames so historic full names never surface. */
export function knownUsernameCondition(metaExpr: SQL): SQL {
  return sql`${metaExpr} IN (SELECT ${users.username} FROM ${users} WHERE ${users.username} IS NOT NULL)`;
}
