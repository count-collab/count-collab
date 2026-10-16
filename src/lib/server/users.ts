import {
  type AnyColumn,
  and,
  asc,
  count as countFn,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "$lib/db";
import {
  accounts,
  counterHistory,
  counters,
  dashboards,
  roles,
  teamMembers,
  teams,
  users,
} from "$lib/db/schema";
import { logEvent } from "$lib/server/events";
import { SoleTeamOwnerError } from "$lib/server/team-limits";
import { deleteTeamInTx, getSoleOwnedTeams } from "$lib/server/teams";
import { emitTeamMembershipChanged } from "$lib/utils/socket";

function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

type UserWithRole = {
  id: string;
  email: string | null;
  image: string | null;
  username: string | null;
  roleName: string | null;
  roleId: number | null;
  createdAt: Date;
};

/**
 * List all users with their role names.
 */
export async function listUsers(
  limit = 50,
  query?: string,
  offset = 0,
  sortBy?: string,
  sortOrder: "asc" | "desc" = "desc",
): Promise<{ items: UserWithRole[]; total: number }> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? or(
        ilike(users.username, `%${escapeLikePattern(searchQuery)}%`),
        ilike(users.email, `%${escapeLikePattern(searchQuery)}%`),
      )
    : undefined;

  const columnMap: Record<string, AnyColumn> = {
    username: users.username,
    email: users.email,
    role: roles.name,
    createdAt: users.createdAt,
  };
  const sortColumn = sortBy && columnMap[sortBy];
  const orderByClause = sortColumn
    ? sortOrder === "asc"
      ? asc(sortColumn)
      : desc(sortColumn)
    : desc(users.createdAt);

  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        image: users.image,
        username: users.username,
        roleName: roles.name,
        roleId: users.roleId,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(users).where(whereClause),
  ]);

  return { items, total: Number(total) };
}

/**
 * Update a user's role.
 */
export async function updateUserRole(
  userId: string,
  roleId: number,
): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ roleId })
    .where(eq(users.id, userId))
    .returning();

  return result.length > 0;
}

/**
 * Delete a user and cascade their data in one transaction.
 * Teams where the user is the only owner are deleted only when nobody else is in them;
 * otherwise throws SoleTeamOwnerError and nothing is changed.
 */
export async function deleteUser(
  userId: string,
  deletedByUserId?: string | null,
): Promise<boolean> {
  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ username: users.username, email: users.email })
      .from(users)
      .where(eq(users.id, userId));

    // Held owner rows serialize with concurrent role changes and removals in those teams
    await tx
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.role, "owner")))
      .for("update");

    let soleOwnedTeams = await getSoleOwnedTeams(userId, tx);
    if (soleOwnedTeams.length > 0) {
      // Lock first, then re-read, so a join that is mid-commit is counted
      for (const team of soleOwnedTeams) {
        await tx
          .select({ id: teams.id })
          .from(teams)
          // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
          .where(eq(teams.id, team.id as any))
          .for("update");
      }
      soleOwnedTeams = await getSoleOwnedTeams(userId, tx);
    }

    const blocking = soleOwnedTeams.filter((team) => team.memberCount > 1);
    if (blocking.length > 0) {
      throw new SoleTeamOwnerError(
        blocking.map(({ id, name, memberCount }) => ({ id, name, memberCount })),
      );
    }

    // Only the user is left in these teams, so nobody else loses data
    const deletedTeams: { teamId: string; remainingMemberIds: string[] }[] = [];
    for (const team of soleOwnedTeams) {
      const deleted = await deleteTeamInTx(
        tx,
        team.id,
        deletedByUserId ?? userId,
      );
      if (deleted.deleted) {
        deletedTeams.push({
          teamId: team.id,
          remainingMemberIds: deleted.memberIds.filter((id) => id !== userId),
        });
      }
    }

    // Personal resources only; team resources survive with ownerId set null by the FK
    await tx
      .delete(dashboards)
      .where(and(eq(dashboards.ownerId, userId), isNull(dashboards.teamId)));
    await tx
      .delete(counters)
      .where(and(eq(counters.ownerId, userId), isNull(counters.teamId)));

    const result = await tx
      .delete(users)
      .where(eq(users.id, userId))
      .returning();

    return { deleted: result.length > 0, existing, deletedTeams };
  });

  for (const { teamId, remainingMemberIds } of outcome.deletedTeams) {
    emitTeamMembershipChanged(remainingMemberIds, {
      teamId,
      reason: "team_deleted",
    });
  }

  if (outcome.deleted) {
    logEvent({
      eventType: "user_deleted",
      userId: deletedByUserId ?? userId,
      entityId: userId,
      entityType: "user",
      metadata: {
        user_name: outcome.existing?.username ?? null,
        email: outcome.existing?.email ?? null,
      },
    });
  }

  return outcome.deleted;
}

/**
 * Get user by username.
 */
export async function getUserByUsername(username: string) {
  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username));
  return user ?? null;
}

/**
 * Check if a username is available.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username.toLowerCase()));
  return !existing;
}

/**
 * Set username for a user.
 */
export async function setUsername(
  userId: string,
  username: string,
): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ username: username.toLowerCase() })
    .where(eq(users.id, userId))
    .returning();
  return result.length > 0;
}

/**
 * Get basic user count and counter count for admin dashboard.
 */
export async function getAdminStats(): Promise<{
  userCount: number;
  counterCount: number;
  dashboardCount: number;
  teamCount: number;
}> {
  const [userRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const [counterRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(counters);
  const [dashboardRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dashboards);
  const [teamRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(teams);

  return {
    userCount: userRow?.count ?? 0,
    counterCount: counterRow?.count ?? 0,
    dashboardCount: dashboardRow?.count ?? 0,
    teamCount: teamRow?.count ?? 0,
  };
}

/**
 * Get the OAuth providers connected to a user's account.
 */
export async function getConnectedProviders(userId: string): Promise<string[]> {
  const rows = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  return rows.map((r) => r.provider);
}

export type UserDetail = {
  user: UserWithRole;
  actionCount: number;
  ownedCounters: {
    id: string;
    title: string;
    count: number;
    visibilityMode: string;
    isPublic: number;
    counterMode: string;
    createdAt: Date;
    updatedAt: Date;
    actionCount: number;
  }[];
  ownedDashboards: {
    id: string;
    title: string;
    visibilityMode: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

/**
 * Get detailed user info for the admin user detail page.
 */
export async function getUserDetail(
  userId: string,
): Promise<UserDetail | null> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      image: users.image,
      username: users.username,
      roleName: roles.name,
      roleId: users.roleId,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId));

  if (!user) return null;

  const [totalActions, counterRows, dashboardRows] = await Promise.all([
    db
      .select({ count: countFn() })
      .from(counterHistory)
      .where(eq(counterHistory.changedBy, userId)),
    db
      .select({
        id: counters.id,
        title: counters.title,
        count: counters.count,
        visibilityMode: counters.visibilityMode,
        isPublic: counters.isPublic,
        counterMode: counters.counterMode,
        createdAt: counters.createdAt,
        updatedAt: counters.updatedAt,
        actionCount: sql<number>`(SELECT count(*) FROM counter_history WHERE counter_id = "counters"."id")`,
      })
      .from(counters)
      .where(eq(counters.ownerId, userId))
      .orderBy(desc(counters.updatedAt)),
    db
      .select({
        id: dashboards.id,
        title: dashboards.title,
        visibilityMode: dashboards.visibilityMode,
        createdAt: dashboards.createdAt,
        updatedAt: dashboards.updatedAt,
      })
      .from(dashboards)
      .where(eq(dashboards.ownerId, userId))
      .orderBy(desc(dashboards.updatedAt)),
  ]);

  return {
    user,
    actionCount: Number(totalActions[0]?.count ?? 0),
    ownedCounters: counterRows.map((row) => ({
      ...row,
      actionCount: Number(row.actionCount),
    })),
    ownedDashboards: dashboardRows,
  };
}
