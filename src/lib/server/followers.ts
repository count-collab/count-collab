import { and, count as countFn, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type Counter,
  counterFollowers,
  counters,
  type Dashboard,
  dashboardFollowers,
  dashboards,
} from "$lib/db/schema";
import { logger } from "$lib/server/logger";

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

export async function getFollowedCounters(userId: string): Promise<Counter[]> {
  const rows = await db
    .select({
      id: counters.id,
      title: counters.title,
      description: counters.description,
      count: counters.count,
      isPublic: counters.isPublic,
      visibilityMode: counters.visibilityMode,
      shareToken: counters.shareToken,
      ownerId: counters.ownerId,
      createdAt: counters.createdAt,
      updatedAt: counters.updatedAt,
    })
    .from(counterFollowers)
    .innerJoin(counters, eq(counterFollowers.counterId, counters.id))
    .where(eq(counterFollowers.userId, userId))
    .orderBy(counterFollowers.followedAt);

  return rows as Counter[];
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

export async function getFollowedDashboards(
  userId: string,
): Promise<Dashboard[]> {
  const rows = await db
    .select({
      id: dashboards.id,
      title: dashboards.title,
      description: dashboards.description,
      visibilityMode: dashboards.visibilityMode,
      shareToken: dashboards.shareToken,
      ownerId: dashboards.ownerId,
      createdAt: dashboards.createdAt,
      updatedAt: dashboards.updatedAt,
    })
    .from(dashboardFollowers)
    .innerJoin(dashboards, eq(dashboardFollowers.dashboardId, dashboards.id))
    .where(eq(dashboardFollowers.userId, userId))
    .orderBy(dashboardFollowers.followedAt);

  return rows as Dashboard[];
}
