import {
  type AnyColumn,
  and,
  asc,
  count as countFn,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "$lib/db";
import type {
  Dashboard,
  DashboardVisibilityMode,
  NewDashboard,
} from "$lib/db/schema";
import {
  dashboardFollowers,
  dashboardMembers,
  dashboards as dashboardsTable,
  users,
} from "$lib/db/schema";
import { escapeLikePattern, generateShareToken } from "$lib/server/crypto";
import { logger } from "$lib/server/logger";

export type DashboardWithFollowerCount = Dashboard & { followerCount: number };

const publicDashboardVisibilityModes: DashboardVisibilityMode[] = ["public"];

type CreateDashboardInput = {
  title: string;
  description?: string | null;
  visibilityMode?: DashboardVisibilityMode;
  ownerId?: string | null;
};

export async function createDashboard(
  input: CreateDashboardInput,
): Promise<Dashboard> {
  const visibilityMode = input.visibilityMode ?? "public";

  const newDashboard: NewDashboard = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    visibilityMode,
    shareToken: visibilityMode === "private" ? generateShareToken() : null,
    ownerId: input.ownerId ?? null,
  };

  const [dashboard] = await db
    .insert(dashboardsTable)
    .values(newDashboard)
    .returning();

  logger.info("Dashboard created", {
    id: dashboard.id,
    title: dashboard.title,
    visibilityMode: dashboard.visibilityMode,
  });

  return dashboard;
}

export async function getDashboard(
  dashboardId: string,
): Promise<Dashboard | null> {
  const [dashboard] = await db
    .select()
    .from(dashboardsTable)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardsTable.id, dashboardId as any));
  return dashboard ?? null;
}

export async function updateDashboard(
  dashboardId: string,
  input: {
    title?: string;
    description?: string;
    visibilityMode?: DashboardVisibilityMode;
  },
): Promise<Dashboard | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) set.title = input.title.trim();
  if (input.description !== undefined)
    set.description = input.description.trim() || null;
  if (input.visibilityMode !== undefined) {
    set.visibilityMode = input.visibilityMode;

    // Generate a share token when switching to private (if not already set)
    if (input.visibilityMode === "private") {
      const existing = await getDashboard(dashboardId);
      if (existing && !existing.shareToken) {
        set.shareToken = generateShareToken();
      }
    }
  }

  const [updated] = await db
    .update(dashboardsTable)
    .set(set)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardsTable.id, dashboardId as any))
    .returning();

  if (updated) {
    logger.info("Dashboard updated", { id: dashboardId });
  }

  return updated ?? null;
}

export async function deleteDashboard(dashboardId: string): Promise<boolean> {
  const result = await db
    .delete(dashboardsTable)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardsTable.id, dashboardId as any))
    .returning();

  if (result.length > 0) {
    logger.info("Dashboard deleted", { id: dashboardId });
  }

  return result.length > 0;
}

export async function listPublicDashboards(
  limit = 12,
  query?: string,
  offset = 0,
): Promise<{ items: DashboardWithFollowerCount[]; total: number }> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? and(
        inArray(dashboardsTable.visibilityMode, publicDashboardVisibilityModes),
        ilike(dashboardsTable.title, `%${escapeLikePattern(searchQuery)}%`),
      )
    : inArray(dashboardsTable.visibilityMode, publicDashboardVisibilityModes);

  const followerCountSubquery = db
    .select({
      dashboardId: dashboardFollowers.dashboardId,
      followerCount: countFn().as("follower_count"),
    })
    .from(dashboardFollowers)
    .groupBy(dashboardFollowers.dashboardId)
    .as("follower_counts");

  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: dashboardsTable.id,
        title: dashboardsTable.title,
        description: dashboardsTable.description,
        visibilityMode: dashboardsTable.visibilityMode,
        shareToken: dashboardsTable.shareToken,
        ownerId: dashboardsTable.ownerId,
        createdAt: dashboardsTable.createdAt,
        updatedAt: dashboardsTable.updatedAt,
        followerCount: sql<number>`coalesce(${followerCountSubquery.followerCount}, 0)`,
      })
      .from(dashboardsTable)
      .leftJoin(
        followerCountSubquery,
        eq(dashboardsTable.id, followerCountSubquery.dashboardId),
      )
      .where(whereClause)
      .orderBy(
        desc(sql`coalesce(${followerCountSubquery.followerCount}, 0)`),
        desc(dashboardsTable.updatedAt),
      )
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(dashboardsTable).where(whereClause),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      followerCount: Number(item.followerCount),
    })),
    total: Number(total),
  };
}

export async function getUserDashboards(
  userId: string,
  limit?: number,
  offset = 0,
): Promise<{ items: Dashboard[]; total: number }> {
  const owned = await db
    .select()
    .from(dashboardsTable)
    .where(eq(dashboardsTable.ownerId, userId))
    .orderBy(desc(dashboardsTable.updatedAt));

  const shared = await db
    .select({
      id: dashboardsTable.id,
      title: dashboardsTable.title,
      description: dashboardsTable.description,
      visibilityMode: dashboardsTable.visibilityMode,
      shareToken: dashboardsTable.shareToken,
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

export async function listAllDashboards(
  limit = 50,
  query?: string,
  offset = 0,
  sortBy?: string,
  sortOrder: "asc" | "desc" = "desc",
): Promise<{
  items: (Dashboard & { ownerName: string | null })[];
  total: number;
}> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? or(
        ilike(dashboardsTable.title, `%${escapeLikePattern(searchQuery)}%`),
        ilike(
          dashboardsTable.description,
          `%${escapeLikePattern(searchQuery)}%`,
        ),
      )
    : undefined;

  const columnMap: Record<string, AnyColumn> = {
    title: dashboardsTable.title,
    visibility: dashboardsTable.visibilityMode,
    owner: users.username,
    createdAt: dashboardsTable.createdAt,
  };
  const sortColumn = sortBy && columnMap[sortBy];
  const orderByClause = sortColumn
    ? sortOrder === "asc"
      ? asc(sortColumn)
      : desc(sortColumn)
    : desc(dashboardsTable.updatedAt);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        dashboard: dashboardsTable,
        ownerUsername: users.username,
        ownerDisplayName: users.name,
      })
      .from(dashboardsTable)
      .leftJoin(users, eq(dashboardsTable.ownerId, users.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(dashboardsTable).where(whereClause),
  ]);

  const items = rows.map((row) => ({
    ...row.dashboard,
    ownerName: row.ownerUsername ?? row.ownerDisplayName ?? null,
  }));

  return { items, total: Number(total) };
}
