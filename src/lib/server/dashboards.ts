import {
  type AnyColumn,
  and,
  asc,
  count as countFn,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "$lib/db";
import type {
  Dashboard,
  DashboardMemberRole,
  DashboardVisibilityMode,
  NewDashboard,
} from "$lib/db/schema";
import {
  dashboardFollowers,
  dashboardMembers,
  dashboards as dashboardsTable,
  teamMembers,
  teams,
  users,
} from "$lib/db/schema";
import { mapTeamRoleToDashboardRole, maxDashboardRole } from "$lib/roles";
import { escapeLikePattern, generateShareToken } from "$lib/server/crypto";
import { logEvent } from "$lib/server/events";
import { logger } from "$lib/server/logger";

export type DashboardWithFollowerCount = Dashboard & { followerCount: number };

const publicDashboardVisibilityModes: DashboardVisibilityMode[] = ["public"];

type CreateDashboardInput = {
  title: string;
  description?: string | null;
  visibilityMode?: DashboardVisibilityMode;
  ownerId?: string | null;
  teamId?: string | null;
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
    teamId: input.teamId ?? null,
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

  logEvent({
    eventType: "dashboard_created",
    userId: dashboard.ownerId,
    entityId: dashboard.id,
    entityType: "dashboard",
    metadata: { dashboard_title: dashboard.title, user_name: null },
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

export async function deleteDashboard(
  dashboardId: string,
  deletedByUserId?: string | null,
): Promise<boolean> {
  // Fetch before deleting so we can log metadata
  const [existing] = await db
    .select({ title: dashboardsTable.title, ownerId: dashboardsTable.ownerId })
    .from(dashboardsTable)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardsTable.id, dashboardId as any));

  const result = await db
    .delete(dashboardsTable)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardsTable.id, dashboardId as any))
    .returning();

  if (result.length > 0) {
    logger.info("Dashboard deleted", { id: dashboardId });
    logEvent({
      eventType: "dashboard_deleted",
      userId: deletedByUserId ?? null,
      entityId: dashboardId,
      entityType: "dashboard",
      metadata: {
        dashboard_title: existing?.title ?? null,
        owner_id: existing?.ownerId ?? null,
      },
    });
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
        teamId: dashboardsTable.teamId,
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

export type UserDashboard = Dashboard & { teamName: string | null };

/** Team-owned dashboards are never personally owned, even by their creator. */
function personallyOwnedDashboard(userId: string) {
  return and(
    eq(dashboardsTable.ownerId, userId),
    isNull(dashboardsTable.teamId),
  );
}

// Unique indexes on (dashboardId, userId) and (teamId, userId) keep these joins at most one row per dashboard.
function directDashboardMemberJoin(userId: string) {
  return and(
    eq(dashboardMembers.dashboardId, dashboardsTable.id),
    eq(dashboardMembers.userId, userId),
  );
}

function dashboardTeamMemberJoin(userId: string) {
  return and(
    eq(teamMembers.teamId, dashboardsTable.teamId),
    eq(teamMembers.userId, userId),
  );
}

/**
 * Get all dashboards the user owns personally, is a direct member of, or can access through a team.
 * Personally owned dashboards come first.
 */
export async function getUserDashboards(
  userId: string,
  limit?: number,
  offset = 0,
): Promise<{ items: UserDashboard[]; total: number }> {
  const whereClause = or(
    personallyOwnedDashboard(userId),
    isNotNull(dashboardMembers.userId),
    isNotNull(teamMembers.userId),
  );

  const itemsQuery = db
    .select({ ...getTableColumns(dashboardsTable), teamName: teams.name })
    .from(dashboardsTable)
    .leftJoin(dashboardMembers, directDashboardMemberJoin(userId))
    .leftJoin(teamMembers, dashboardTeamMemberJoin(userId))
    .leftJoin(teams, eq(teams.id, dashboardsTable.teamId))
    .where(whereClause)
    .orderBy(
      sql`CASE WHEN ${dashboardsTable.ownerId} = ${userId} AND ${dashboardsTable.teamId} IS NULL THEN 0 ELSE 1 END`,
      desc(dashboardsTable.updatedAt),
    )
    .$dynamic();

  const [items, [{ total }]] = await Promise.all([
    limit !== undefined ? itemsQuery.limit(limit).offset(offset) : itemsQuery,
    db
      .select({ total: countFn() })
      .from(dashboardsTable)
      .leftJoin(dashboardMembers, directDashboardMemberJoin(userId))
      .leftJoin(teamMembers, dashboardTeamMemberJoin(userId))
      .where(whereClause),
  ]);

  return { items, total: Number(total) };
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
    updatedAt: dashboardsTable.updatedAt,
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

/**
 * Get only dashboards owned personally by a user (excludes team dashboards).
 */
export async function getOwnedDashboards(
  userId: string,
  limit?: number,
  offset = 0,
): Promise<{ items: Dashboard[]; total: number }> {
  const whereClause = personallyOwnedDashboard(userId);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(dashboardsTable)
      .where(whereClause)
      .orderBy(desc(dashboardsTable.updatedAt))
      .limit(limit ?? 1000)
      .offset(offset),
    db.select({ total: countFn() }).from(dashboardsTable).where(whereClause),
  ]);

  return { items: rows, total: Number(total) };
}

export type SharedDashboard = UserDashboard & {
  memberRole: DashboardMemberRole;
};

/**
 * Get dashboards the user can access via direct membership or a team, excluding personally owned ones.
 * memberRole is the effective role (highest of direct and team-derived role).
 */
export async function getSharedDashboards(
  userId: string,
  limit?: number,
  offset = 0,
): Promise<{ items: SharedDashboard[]; total: number }> {
  const baseCondition = and(
    or(isNotNull(dashboardMembers.userId), isNotNull(teamMembers.userId)),
    or(
      isNotNull(dashboardsTable.teamId),
      sql`${dashboardsTable.ownerId} IS DISTINCT FROM ${userId}`,
    ),
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        ...getTableColumns(dashboardsTable),
        teamName: teams.name,
        directRole: dashboardMembers.role,
        teamRole: teamMembers.role,
      })
      .from(dashboardsTable)
      .leftJoin(dashboardMembers, directDashboardMemberJoin(userId))
      .leftJoin(teamMembers, dashboardTeamMemberJoin(userId))
      .leftJoin(teams, eq(teams.id, dashboardsTable.teamId))
      .where(baseCondition)
      .orderBy(desc(dashboardsTable.updatedAt))
      .limit(limit ?? 1000)
      .offset(offset),
    db
      .select({ total: countFn() })
      .from(dashboardsTable)
      .leftJoin(dashboardMembers, directDashboardMemberJoin(userId))
      .leftJoin(teamMembers, dashboardTeamMemberJoin(userId))
      .where(baseCondition),
  ]);

  const items = rows.map(({ directRole, teamRole, ...dashboard }) => ({
    ...dashboard,
    memberRole:
      maxDashboardRole(
        directRole,
        teamRole ? mapTeamRoleToDashboardRole(teamRole) : null,
      ) ?? "viewer",
  }));

  return { items, total: Number(total) };
}
