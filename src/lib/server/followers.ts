import { and, count as countFn, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  counterFollowers,
  counters,
  dashboardFollowers,
  dashboards,
  type PublicCounter,
  type PublicDashboard,
} from "$lib/db/schema";
import { logEvent } from "$lib/server/events";
import { logger } from "$lib/server/logger";

// Lets callers run follower removal inside their own transaction
type Executor = Pick<typeof db, "delete">;

// ── Counter Followers ───────────────────────────────────────────

export async function followCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  const result = await db
    .insert(counterFollowers)
    .values({ counterId, userId })
    .onConflictDoNothing()
    .returning();

  if (result.length > 0) {
    logger.info("User followed counter", { userId, counterId });
    logEvent({
      eventType: "follower_added",
      userId,
      entityId: counterId,
      entityType: "follower",
      metadata: { target_type: "counter" },
    });
    return true;
  }
  return false;
}

export async function unfollowCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  const result = await db
    .delete(counterFollowers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterFollowers.counterId, counterId as any),
        eq(counterFollowers.userId, userId),
      ),
    )
    .returning();

  if (result.length > 0) {
    logger.info("User unfollowed counter", { userId, counterId });
    logEvent({
      eventType: "follower_removed",
      userId,
      entityId: counterId,
      entityType: "follower",
      metadata: { target_type: "counter" },
    });
    return true;
  }
  return false;
}

export async function isFollowingCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: counterFollowers.id })
    .from(counterFollowers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterFollowers.counterId, counterId as any),
        eq(counterFollowers.userId, userId),
      ),
    );
  return !!row;
}

export async function getCounterFollowerCount(
  counterId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: countFn() })
    .from(counterFollowers)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counterFollowers.counterId, counterId as any));
  return row?.count ?? 0;
}

/** Remove every follower of a counter and return how many were removed. */
export async function removeCounterFollowers(
  counterId: string,
  executor: Executor = db,
): Promise<number> {
  const removed = await executor
    .delete(counterFollowers)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counterFollowers.counterId, counterId as any))
    .returning({ id: counterFollowers.id });
  return removed.length;
}

export async function getFollowedCounters(
  userId: string,
): Promise<PublicCounter[]> {
  const rows = await db
    .select({
      id: counters.id,
      title: counters.title,
      description: counters.description,
      count: counters.count,
      isPublic: counters.isPublic,
      visibilityMode: counters.visibilityMode,
      ownerId: counters.ownerId,
      createdAt: counters.createdAt,
      updatedAt: counters.updatedAt,
    })
    .from(counterFollowers)
    .innerJoin(counters, eq(counterFollowers.counterId, counters.id))
    .where(eq(counterFollowers.userId, userId))
    .orderBy(counterFollowers.followedAt);

  return rows as PublicCounter[];
}

// ── Dashboard Followers ─────────────────────────────────────────

export async function followDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  const result = await db
    .insert(dashboardFollowers)
    .values({ dashboardId, userId })
    .onConflictDoNothing()
    .returning();

  if (result.length > 0) {
    logger.info("User followed dashboard", { userId, dashboardId });
    logEvent({
      eventType: "follower_added",
      userId,
      entityId: dashboardId,
      entityType: "follower",
      metadata: { target_type: "dashboard" },
    });
    return true;
  }
  return false;
}

export async function unfollowDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  const result = await db
    .delete(dashboardFollowers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardFollowers.dashboardId, dashboardId as any),
        eq(dashboardFollowers.userId, userId),
      ),
    )
    .returning();

  if (result.length > 0) {
    logger.info("User unfollowed dashboard", { userId, dashboardId });
    logEvent({
      eventType: "follower_removed",
      userId,
      entityId: dashboardId,
      entityType: "follower",
      metadata: { target_type: "dashboard" },
    });
    return true;
  }
  return false;
}

export async function isFollowingDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: dashboardFollowers.id })
    .from(dashboardFollowers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardFollowers.dashboardId, dashboardId as any),
        eq(dashboardFollowers.userId, userId),
      ),
    );
  return !!row;
}

export async function getDashboardFollowerCount(
  dashboardId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: countFn() })
    .from(dashboardFollowers)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardFollowers.dashboardId, dashboardId as any));
  return row?.count ?? 0;
}

/** Remove every follower of a dashboard and return how many were removed. */
export async function removeDashboardFollowers(
  dashboardId: string,
  executor: Executor = db,
): Promise<number> {
  const removed = await executor
    .delete(dashboardFollowers)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardFollowers.dashboardId, dashboardId as any))
    .returning({ id: dashboardFollowers.id });
  return removed.length;
}

export async function getFollowedDashboards(
  userId: string,
): Promise<PublicDashboard[]> {
  const rows = await db
    .select({
      id: dashboards.id,
      title: dashboards.title,
      description: dashboards.description,
      visibilityMode: dashboards.visibilityMode,
      ownerId: dashboards.ownerId,
      createdAt: dashboards.createdAt,
      updatedAt: dashboards.updatedAt,
    })
    .from(dashboardFollowers)
    .innerJoin(dashboards, eq(dashboardFollowers.dashboardId, dashboards.id))
    .where(eq(dashboardFollowers.userId, userId))
    .orderBy(dashboardFollowers.followedAt);

  return rows as PublicDashboard[];
}
