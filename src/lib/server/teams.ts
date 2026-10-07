import {
  and,
  asc,
  count as countFn,
  desc,
  eq,
  ilike,
  inArray,
  sql,
} from "drizzle-orm";
import { db } from "$lib/db";
import type {
  Counter,
  Dashboard,
  NewTeam,
  Team,
  TeamMemberRole,
} from "$lib/db/schema";
import {
  counters as countersTable,
  dashboards as dashboardsTable,
  teamMemberRoles,
  teamMembers,
  teams as teamsTable,
} from "$lib/db/schema";
import { isTeamRoleAtLeast } from "$lib/roles";
import { escapeLikePattern } from "$lib/server/crypto";
import { logEvent, logEventInTx } from "$lib/server/events";
import { logger } from "$lib/server/logger";

export type TeamCounts = {
  memberCount: number;
  counterCount: number;
  dashboardCount: number;
};

export type TeamSummary = Omit<Team, "joinToken">;

export type UserTeam = TeamSummary & TeamCounts & { role: TeamMemberRole };

export type TeamWithCounts = TeamSummary & TeamCounts;

export type DeleteTeamResult = {
  deleted: boolean;
  counterIds: string[];
  dashboardIds: string[];
  memberIds: string[];
};

const memberCountSql = sql<number>`(SELECT count(*)::int FROM team_members WHERE team_id = "teams"."id")`;
const counterCountSql = sql<number>`(SELECT count(*)::int FROM counters WHERE team_id = "teams"."id")`;
const dashboardCountSql = sql<number>`(SELECT count(*)::int FROM dashboards WHERE team_id = "teams"."id")`;

// The join token is a secret for team managers; list views never need it
function withoutJoinToken({ joinToken: _, ...team }: Team): TeamSummary {
  return team;
}

function toCounts(row: {
  memberCount: number | string;
  counterCount: number | string;
  dashboardCount: number | string;
}): TeamCounts {
  return {
    memberCount: Number(row.memberCount),
    counterCount: Number(row.counterCount),
    dashboardCount: Number(row.dashboardCount),
  };
}

type CreateTeamInput = {
  name: string;
  description?: string | null;
  userId: string;
};

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  const newTeam: NewTeam = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    createdBy: input.userId,
  };

  const team = await db.transaction(async (tx) => {
    const [created] = await tx.insert(teamsTable).values(newTeam).returning();
    await tx.insert(teamMembers).values({
      teamId: created.id,
      userId: input.userId,
      role: "owner",
    });
    return created;
  });

  logger.info("Team created", { id: team.id, name: team.name });

  logEvent({
    eventType: "team_created",
    userId: input.userId,
    entityId: team.id,
    entityType: "team",
    metadata: { team_name: team.name },
  });

  return team;
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const [team] = await db
    .select()
    .from(teamsTable)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(teamsTable.id, teamId as any));
  return team ?? null;
}

export async function updateTeam(
  teamId: string,
  input: { name?: string; description?: string | null },
): Promise<Team | null> {
  const set: Partial<NewTeam> = { updatedAt: new Date() };

  if (input.name !== undefined) set.name = input.name.trim();
  if (input.description !== undefined)
    set.description = input.description?.trim() || null;

  const [updated] = await db
    .update(teamsTable)
    .set(set)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(teamsTable.id, teamId as any))
    .returning();

  if (updated) {
    logger.info("Team updated", { id: teamId });
  }

  return updated ?? null;
}

/**
 * Delete a team together with all its counters and dashboards.
 * Returns the deleted resource ids so callers can emit socket events.
 */
export async function deleteTeam(
  teamId: string,
  actorUserId: string | null,
): Promise<DeleteTeamResult> {
  const result = await db.transaction(async (tx): Promise<DeleteTeamResult> => {
    // Blocks concurrent member adds, joins, transfers and creates into this team
    const [team] = await tx
      .select({ name: teamsTable.name })
      .from(teamsTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(teamsTable.id, teamId as any))
      .for("update");

    if (!team) {
      return {
        deleted: false,
        counterIds: [],
        dashboardIds: [],
        memberIds: [],
      };
    }

    const members = await tx
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(teamMembers.teamId, teamId as any));

    const deletedDashboards = await tx
      .delete(dashboardsTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(dashboardsTable.teamId, teamId as any))
      .returning({
        id: dashboardsTable.id,
        title: dashboardsTable.title,
        ownerId: dashboardsTable.ownerId,
      });

    for (const dashboard of deletedDashboards) {
      await logEventInTx(tx, {
        eventType: "dashboard_deleted",
        userId: actorUserId,
        entityId: dashboard.id,
        entityType: "dashboard",
        metadata: {
          dashboard_title: dashboard.title,
          owner_id: dashboard.ownerId,
        },
      });
    }

    const deletedCounters = await tx
      .delete(countersTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(countersTable.teamId, teamId as any))
      .returning({
        id: countersTable.id,
        title: countersTable.title,
        ownerId: countersTable.ownerId,
      });

    for (const counter of deletedCounters) {
      await logEventInTx(tx, {
        eventType: "counter_deleted",
        userId: actorUserId,
        entityId: counter.id,
        entityType: "counter",
        metadata: {
          counter_title: counter.title,
          owner_id: counter.ownerId,
        },
      });
    }

    await tx
      .delete(teamsTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(teamsTable.id, teamId as any));

    await logEventInTx(tx, {
      eventType: "team_deleted",
      userId: actorUserId,
      entityId: teamId,
      entityType: "team",
      metadata: {
        team_name: team.name,
        counter_count: deletedCounters.length,
        dashboard_count: deletedDashboards.length,
      },
    });

    return {
      deleted: true,
      counterIds: deletedCounters.map((c) => c.id),
      dashboardIds: deletedDashboards.map((d) => d.id),
      memberIds: members.map((m) => m.userId),
    };
  });

  if (result.deleted) {
    logger.info("Team deleted", {
      id: teamId,
      counters: result.counterIds.length,
      dashboards: result.dashboardIds.length,
    });
  }

  return result;
}

export async function listUserTeams(userId: string): Promise<UserTeam[]> {
  const rows = await db
    .select({
      team: teamsTable,
      role: teamMembers.role,
      memberCount: memberCountSql,
      counterCount: counterCountSql,
      dashboardCount: dashboardCountSql,
    })
    .from(teamMembers)
    .innerJoin(teamsTable, eq(teamMembers.teamId, teamsTable.id))
    .where(eq(teamMembers.userId, userId))
    .orderBy(asc(teamsTable.name));

  return rows.map((row) => ({
    ...withoutJoinToken(row.team),
    role: row.role,
    ...toCounts(row),
  }));
}

const editorOrHigherRoles = teamMemberRoles.filter((role) =>
  isTeamRoleAtLeast(role, "editor"),
);

/**
 * Teams where the user can create/own resources (editor+), for owner selectors.
 */
export async function listEditableTeams(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: teamsTable.id, name: teamsTable.name })
    .from(teamMembers)
    .innerJoin(teamsTable, eq(teamMembers.teamId, teamsTable.id))
    .where(
      and(
        eq(teamMembers.userId, userId),
        inArray(teamMembers.role, editorOrHigherRoles),
      ),
    )
    .orderBy(asc(teamsTable.name));
}

export async function getTeamResources(
  teamId: string,
): Promise<{ counters: Counter[]; dashboards: Dashboard[] }> {
  const [counters, dashboards] = await Promise.all([
    db
      .select()
      .from(countersTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(countersTable.teamId, teamId as any))
      .orderBy(desc(countersTable.updatedAt)),
    db
      .select()
      .from(dashboardsTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(dashboardsTable.teamId, teamId as any))
      .orderBy(desc(dashboardsTable.updatedAt)),
  ]);

  return { counters, dashboards };
}

/**
 * List all teams (for admin dashboard).
 */
export async function listAllTeams(
  limit = 50,
  query?: string,
  offset = 0,
): Promise<{ items: TeamWithCounts[]; total: number }> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? ilike(teamsTable.name, `%${escapeLikePattern(searchQuery)}%`)
    : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        team: teamsTable,
        memberCount: memberCountSql,
        counterCount: counterCountSql,
        dashboardCount: dashboardCountSql,
      })
      .from(teamsTable)
      .where(whereClause)
      .orderBy(desc(teamsTable.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(teamsTable).where(whereClause),
  ]);

  const items = rows.map((row) => ({
    ...withoutJoinToken(row.team),
    ...toCounts(row),
  }));

  return { items, total: Number(total) };
}

/**
 * Teams where the given user is the only member with role "owner".
 */
export async function getSoleOwnedTeams(
  userId: string,
): Promise<TeamWithCounts[]> {
  const rows = await db
    .select({
      team: teamsTable,
      memberCount: memberCountSql,
      counterCount: counterCountSql,
      dashboardCount: dashboardCountSql,
    })
    .from(teamMembers)
    .innerJoin(teamsTable, eq(teamMembers.teamId, teamsTable.id))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, "owner"),
        sql`(SELECT count(*) FROM team_members o WHERE o.team_id = "teams"."id" AND o.role = 'owner') = 1`,
      ),
    )
    .orderBy(asc(teamsTable.name));

  return rows.map((row) => ({
    ...withoutJoinToken(row.team),
    ...toCounts(row),
  }));
}
