import {
  and,
  count as countFn,
  desc,
  eq,
  ilike,
  inArray,
  sql,
} from "drizzle-orm";
import { db } from "$lib/db";
import type {
  Dashboard,
  DashboardVisibilityMode,
  NewDashboard,
} from "$lib/db/schema";
import {
  dashboardMembers,
  dashboards as dashboardsTable,
} from "$lib/db/schema";
import { escapeLikePattern, generateShareToken } from "$lib/server/crypto";
import { logger } from "$lib/server/logger";

export type DashboardWithMemberCount = Dashboard & { memberCount: number };

const publicDashboardVisibilityModes: DashboardVisibilityMode[] = [
  "public",
  "public_readonly",
];

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
): Promise<{ items: DashboardWithMemberCount[]; total: number }> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? and(
        inArray(dashboardsTable.visibilityMode, publicDashboardVisibilityModes),
        ilike(dashboardsTable.title, `%${escapeLikePattern(searchQuery)}%`),
      )
    : inArray(dashboardsTable.visibilityMode, publicDashboardVisibilityModes);

  const memberCountSubquery = db
    .select({
      dashboardId: dashboardMembers.dashboardId,
      memberCount: countFn().as("member_count"),
    })
    .from(dashboardMembers)
    .groupBy(dashboardMembers.dashboardId)
    .as("member_counts");

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
        memberCount: sql<number>`coalesce(${memberCountSubquery.memberCount}, 0)`,
      })
      .from(dashboardsTable)
      .leftJoin(
        memberCountSubquery,
        eq(dashboardsTable.id, memberCountSubquery.dashboardId),
      )
      .where(whereClause)
      .orderBy(
        desc(sql`coalesce(${memberCountSubquery.memberCount}, 0)`),
        desc(dashboardsTable.updatedAt),
      )
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(dashboardsTable).where(whereClause),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      memberCount: Number(item.memberCount),
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
