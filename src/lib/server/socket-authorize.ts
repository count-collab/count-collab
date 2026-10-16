import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "$lib/db";
import { counters, dashboards } from "$lib/db/schema";
import { canViewPrivateCounter } from "$lib/server/authorize";
import { canViewDashboard } from "$lib/server/dashboard-authorize";
import { logger } from "$lib/server/logger";
import { hasValidShareToken } from "$lib/server/share-token";
import { canViewTeam } from "$lib/server/team-authorize";
import {
  SUBSCRIBABLE_ROOM_TYPES,
  type SubscribeRequest,
} from "$lib/utils/socket-rooms";

const MAX_SHARE_TOKEN_LENGTH = 128;

export const subscribeRequestSchema = z
  .object({
    type: z.enum(SUBSCRIBABLE_ROOM_TYPES),
    id: z.string().uuid().optional(),
    token: z.string().max(MAX_SHARE_TOKEN_LENGTH).nullish(),
  })
  .strict()
  .refine((req) => req.type === "feed" || !!req.id);

type PrivateResource = {
  visibilityMode: string;
  shareToken: string | null;
};

async function findCounter(id: string): Promise<PrivateResource | undefined> {
  const [row] = await db
    .select({
      visibilityMode: counters.visibilityMode,
      shareToken: counters.shareToken,
    })
    .from(counters)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counters.id, id as any));
  return row;
}

async function findDashboard(id: string): Promise<PrivateResource | undefined> {
  const [row] = await db
    .select({
      visibilityMode: dashboards.visibilityMode,
      shareToken: dashboards.shareToken,
    })
    .from(dashboards)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboards.id, id as any));
  return row;
}

/**
 * Decide whether a socket may join a room. Missing and forbidden resources both
 * return false so callers cannot probe for private resources.
 */
export async function authorizeSubscription(
  userId: string | null,
  request: SubscribeRequest,
): Promise<boolean> {
  try {
    if (request.type === "feed") return true;
    const id = request.id;
    if (!id) return false;

    if (request.type === "team") {
      return !!userId && (await canViewTeam(userId, id));
    }

    const isCounter = request.type === "counter";
    const resource = isCounter
      ? await findCounter(id)
      : await findDashboard(id);
    if (!resource) return false;

    if (resource.visibilityMode !== "private") return true;
    if (hasValidShareToken(resource, request.token)) return true;
    if (!userId) return false;

    return isCounter
      ? await canViewPrivateCounter(userId, id)
      : await canViewDashboard(userId, id);
  } catch (err) {
    logger.warn("Socket subscribe authorization failed", {
      type: request.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
