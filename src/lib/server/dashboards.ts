import { and, count as countFn, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "$lib/db";
import type { Counter, Dashboard, NewDashboard } from "$lib/db/schema";
import {
  counters as countersTable,
  dashboardCounters,
  dashboardMembers,
  dashboards as dashboardsTable,
} from "$lib/db/schema";
import { logger } from "$lib/server/logger";

const MAX_COUNTERS_PER_DASHBOARD = 100;

function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

// ── CRUD ────────────────────────────────────────────────────────

type CreateDashboardInput = {
  title: string;
  description?: string | null;
  isPublic: boolean;
  ownerId: string;
};

export async function createDashboard(
  input: CreateDashboardInput,
): Promise<Dashboard> {
  return await db.transaction(async (tx) => {
    // Check if user already has a dashboard — if not, this becomes the main one
    const [existing] = await tx
      .select({ id: dashboardsTable.id })
      .from(dashboardsTable)
      .where(eq(dashboardsTable.ownerId, input.ownerId))
      .limit(1);

    const isMain = existing ? 0 : 1;

    const newDashboard: NewDashboard = {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      isPublic: input.isPublic ? 1 : 0,
      isMain,
      ownerId: input.ownerId,
    };

    const [dashboard] = await tx
      .insert(dashboardsTable)
      .values(newDashboard)
      .returning();

    logger.info("Dashboard created", {
      id: dashboard.id,
      title: dashboard.title,
      isMain,
      ownerId: input.ownerId,
    });

    return dashboard;
  });
}

export async function getDashboard(
  dashboardId: string,
): Promise<Dashboard | null> {
  const [dashboard] = await db
    .select()
    .from(dashboardsTable)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
    .where(eq(dashboardsTable.id, dashboardId as any));
  return dashboard ?? null;
}

export async function updateDashboard(
  dashboardId: string,
  input: { title?: string; description?: string; isPublic?: boolean },
): Promise<Dashboard | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) set.title = input.title.trim();
  if (input.description !== undefined)
    set.description = input.description.trim() || null;
  if (input.isPublic !== undefined) set.isPublic = input.isPublic ? 1 : 0;

  const [updated] = await db
    .update(dashboardsTable)
    .set(set)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
    .where(eq(dashboardsTable.id, dashboardId as any))
    .returning();

  if (updated) {
    logger.info("Dashboard updated", { id: dashboardId });
  }

  return updated ?? null;
}

export async function deleteDashboard(dashboardId: string): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const [dashboard] = await tx
      .select()
      .from(dashboardsTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
      .where(eq(dashboardsTable.id, dashboardId as any));

    if (!dashboard) return false;

    await tx
      .delete(dashboardsTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
      .where(eq(dashboardsTable.id, dashboardId as any));

    logger.info("Dashboard deleted", { id: dashboardId });

    // If the deleted dashboard was the main one, promote the oldest remaining
    if (dashboard.isMain) {
      const [next] = await tx
        .select()
        .from(dashboardsTable)
        .where(eq(dashboardsTable.ownerId, dashboard.ownerId))
        .orderBy(dashboardsTable.createdAt)
        .limit(1);

      if (next) {
        await tx
          .update(dashboardsTable)
          .set({ isMain: 1, updatedAt: new Date() })
          .where(eq(dashboardsTable.id, next.id));

        logger.info("Dashboard auto-promoted to main", {
          id: next.id,
          ownerId: dashboard.ownerId,
        });
      }
    }

    return true;
  });
}

// ── Main dashboard ──────────────────────────────────────────────

export async function setMainDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    // Verify ownership
    const [dashboard] = await tx
      .select()
      .from(dashboardsTable)
      .where(
        and(
          // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
          eq(dashboardsTable.id, dashboardId as any),
          eq(dashboardsTable.ownerId, userId),
        ),
      );

    if (!dashboard) return false;

    // Unset current main
    await tx
      .update(dashboardsTable)
      .set({ isMain: 0, updatedAt: new Date() })
      .where(
        and(eq(dashboardsTable.ownerId, userId), eq(dashboardsTable.isMain, 1)),
      );

    // Set new main
    await tx
      .update(dashboardsTable)
      .set({ isMain: 1, updatedAt: new Date() })
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
      .where(eq(dashboardsTable.id, dashboardId as any));

    logger.info("Dashboard set as main", {
      id: dashboardId,
      userId,
    });

    return true;
  });
}

export async function getMainDashboard(
  userId: string,
): Promise<Dashboard | null> {
  const [dashboard] = await db
    .select()
    .from(dashboardsTable)
    .where(
      and(eq(dashboardsTable.ownerId, userId), eq(dashboardsTable.isMain, 1)),
    );
  return dashboard ?? null;
}

// ── Listing ─────────────────────────────────────────────────────

export async function getUserDashboards(
  userId: string,
  limit?: number,
  offset = 0,
): Promise<{ items: Dashboard[]; total: number }> {
  const owned = await db
    .select()
    .from(dashboardsTable)
    .where(eq(dashboardsTable.ownerId, userId))
    .orderBy(desc(dashboardsTable.isMain), desc(dashboardsTable.updatedAt));

  const shared = await db
    .select({
      id: dashboardsTable.id,
      title: dashboardsTable.title,
      description: dashboardsTable.description,
      isPublic: dashboardsTable.isPublic,
      isMain: dashboardsTable.isMain,
      ownerId: dashboardsTable.ownerId,
      createdAt: dashboardsTable.createdAt,
      updatedAt: dashboardsTable.updatedAt,
    })
    .from(dashboardMembers)
    .innerJoin(
      dashboardsTable,
      eq(dashboardMembers.dashboardId, dashboardsTable.id),
    )
    .where(eq(dashboardMembers.userId, userId))
    .orderBy(desc(dashboardsTable.updatedAt));

  // Deduplicate (owner could also be a member)
  const seen = new Set(owned.map((d) => d.id));
  const all = [...owned, ...shared.filter((d) => !seen.has(d.id))];
  const total = all.length;

  if (limit !== undefined) {
    return { items: all.slice(offset, offset + limit), total };
  }
  return { items: all, total };
}

export async function listPublicDashboards(
  limit = 12,
  query?: string,
  offset = 0,
): Promise<{ items: Dashboard[]; total: number }> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? and(
      eq(dashboardsTable.isPublic, 1),
      or(
        ilike(dashboardsTable.title, `%${escapeLikePattern(searchQuery)}%`),
        ilike(
          dashboardsTable.description,
          `%${escapeLikePattern(searchQuery)}%`,
        ),
      ),
    )
    : eq(dashboardsTable.isPublic, 1);

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(dashboardsTable)
      .where(whereClause)
      .orderBy(desc(dashboardsTable.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(dashboardsTable).where(whereClause),
  ]);

  return { items, total: Number(total) };
}

// ── Dashboard counters ──────────────────────────────────────────

export async function addCounterToDashboard(
  dashboardId: string,
  counterId: string,
): Promise<boolean> {
  // Enforce soft limit
  const [{ count: currentCount }] = await db
    .select({ count: countFn() })
    .from(dashboardCounters)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
    .where(eq(dashboardCounters.dashboardId, dashboardId as any));

  if (Number(currentCount) >= MAX_COUNTERS_PER_DASHBOARD) {
    return false;
  }

  await db
    .insert(dashboardCounters)
    .values({ dashboardId, counterId })
    .onConflictDoNothing();

  logger.info("Counter added to dashboard", { dashboardId, counterId });
  return true;
}

export async function removeCounterFromDashboard(
  dashboardId: string,
  counterId: string,
): Promise<boolean> {
  const result = await db
    .delete(dashboardCounters)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
        eq(dashboardCounters.dashboardId, dashboardId as any),
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
        eq(dashboardCounters.counterId, counterId as any),
      ),
    )
    .returning();

  return result.length > 0;
}

export async function getDashboardCounters(
  dashboardId: string,
  limit = 50,
  offset = 0,
): Promise<{ items: Counter[]; total: number }> {
  // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
  const whereClause = eq(dashboardCounters.dashboardId, dashboardId as any);

  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: countersTable.id,
        title: countersTable.title,
        description: countersTable.description,
        count: countersTable.count,
        isPublic: countersTable.isPublic,
        ownerId: countersTable.ownerId,
        createdAt: countersTable.createdAt,
        updatedAt: countersTable.updatedAt,
      })
      .from(dashboardCounters)
      .innerJoin(
        countersTable,
        eq(dashboardCounters.counterId, countersTable.id),
      )
      .where(whereClause)
      .orderBy(desc(dashboardCounters.addedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(dashboardCounters).where(whereClause),
  ]);

  return { items, total: Number(total) };
}

/**
 * Get dashboard IDs that contain a specific counter, for a given user's dashboards.
 */
export async function getUserDashboardsForCounter(
  userId: string,
  counterId: string,
): Promise<string[]> {
  const rows = await db
    .select({ dashboardId: dashboardCounters.dashboardId })
    .from(dashboardCounters)
    .innerJoin(
      dashboardsTable,
      eq(dashboardCounters.dashboardId, dashboardsTable.id),
    )
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
        eq(dashboardCounters.counterId, counterId as any),
        eq(dashboardsTable.ownerId, userId),
      ),
    );

  return rows.map((r) => r.dashboardId);
}

/**
 * Get the count of counters in a dashboard.
 */
export async function getDashboardCounterCount(
  dashboardId: string,
): Promise<number> {
  const [{ total }] = await db
    .select({ total: countFn() })
    .from(dashboardCounters)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
    .where(eq(dashboardCounters.dashboardId, dashboardId as any));

  return Number(total);
}
