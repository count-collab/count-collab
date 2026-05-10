import { db } from "$lib/db";
import {
  type PlatformEntityType,
  type PlatformEventType,
  platformEvents,
} from "$lib/db/schema";
import { logger } from "./logger";

export type LogEventParams = {
  eventType: PlatformEventType;
  userId?: string | null;
  entityId?: string | null;
  entityType?: PlatformEntityType | null;
  metadata?: Record<string, unknown>;
};

/**
 * Log a platform event for analytics tracking.
 * Fire-and-forget by default — errors are logged but never thrown.
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    await db.insert(platformEvents).values({
      eventType: params.eventType,
      userId: params.userId ?? null,
      entityId: params.entityId ?? null,
      entityType: params.entityType ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    logger.error("Failed to log platform event", {
      eventType: params.eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Log a platform event within an existing transaction.
 * Accepts a Drizzle transaction object so the event is committed atomically
 * with the surrounding operation (e.g., deletion).
 */
export async function logEventInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: LogEventParams,
): Promise<void> {
  await tx.insert(platformEvents).values({
    eventType: params.eventType,
    userId: params.userId ?? null,
    entityId: params.entityId ?? null,
    entityType: params.entityType ?? null,
    metadata: params.metadata ?? {},
  });
}
