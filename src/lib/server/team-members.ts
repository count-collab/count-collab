import { and, asc, count as countFn, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type TeamJoinLinkRole,
  type TeamMember,
  type TeamMemberRole,
  teamInvitations,
  teamMembers,
  teams,
  users,
} from "$lib/db/schema";
import { canAssignTeamRole, teamRoleRank } from "$lib/roles";
import { generateShareToken, tokensEqual } from "$lib/server/crypto";
import { logEvent } from "$lib/server/events";
import { logger } from "$lib/server/logger";
import { hasPermission } from "$lib/server/permissions";

export type TeamMemberWithUser = TeamMember & {
  username: string | null;
  image: string | null;
};

export type TeamMemberFailure = {
  ok: false;
  status: 403 | 404 | 409;
  message: string;
};

export type UpdateTeamMemberRoleResult =
  | { ok: true; member: TeamMember }
  | TeamMemberFailure;

export type RemoveTeamMemberResult = { ok: true } | TeamMemberFailure;

/** actingRole as resolved by getActingTeamRole (platform admins act as owner). */
export type TeamMemberActor = { userId: string; actingRole: TeamMemberRole };

export type JoinTeamResult =
  | { ok: true; member: TeamMember; alreadyMember: boolean }
  | TeamMemberFailure;

const MEMBER_NOT_FOUND: TeamMemberFailure = {
  ok: false,
  status: 404,
  message: "Team member not found",
};

const LAST_OWNER: TeamMemberFailure = {
  ok: false,
  status: 409,
  message: "A team must have at least one owner",
};

const FORBIDDEN: TeamMemberFailure = {
  ok: false,
  status: 403,
  message: "You don't have permission to change this member",
};

const INVALID_JOIN_LINK: TeamMemberFailure = {
  ok: false,
  status: 404,
  message: "Invalid join link",
};

function memberWhere(teamId: string, userId: string) {
  return and(
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    eq(teamMembers.teamId, teamId as any),
    eq(teamMembers.userId, userId),
  );
}

/**
 * Get all members of a team with user details, highest role first, then by join date.
 */
export async function getTeamMembers(
  teamId: string,
): Promise<TeamMemberWithUser[]> {
  const rows = await db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      username: users.username,
      image: users.image,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(teamMembers.teamId, teamId as any))
    .orderBy(asc(teamMembers.joinedAt));

  // Array#sort is stable, so joinedAt order is kept within a role
  return rows.sort((a, b) => teamRoleRank(b.role) - teamRoleRank(a.role));
}

export async function countTeamOwners(teamId: string): Promise<number> {
  const [row] = await db
    .select({ count: countFn() })
    .from(teamMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(teamMembers.teamId, teamId as any),
        eq(teamMembers.role, "owner"),
      ),
    );
  return Number(row?.count ?? 0);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Lock the team's owner rows so concurrent demotions/removals serialize.
 */
async function lockOwnerIds(tx: Tx, teamId: string): Promise<string[]> {
  const owners = await tx
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(teamMembers.teamId, teamId as any),
        eq(teamMembers.role, "owner"),
      ),
    )
    .for("update");
  return owners.map((o) => o.userId);
}

async function lockTargetRole(
  tx: Tx,
  teamId: string,
  userId: string,
): Promise<TeamMemberRole | null> {
  const [row] = await tx
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(memberWhere(teamId, userId))
    .for("update");
  return row?.role ?? null;
}

/**
 * Re-read the actor's role under a share lock so a concurrent demotion can't commit mid-change.
 */
async function lockActingRole(
  tx: Tx,
  teamId: string,
  actor: TeamMemberActor,
  targetUserId: string,
  targetRole: TeamMemberRole,
): Promise<TeamMemberRole | null> {
  let memberRole: TeamMemberRole | null = targetRole;
  if (actor.userId !== targetUserId) {
    const [row] = await tx
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(memberWhere(teamId, actor.userId))
      .for("share");
    memberRole = row?.role ?? null;
  }

  // "owner" without an owner row can only come from the platform team:edit_any permission
  if (
    actor.actingRole === "owner" &&
    memberRole !== "owner" &&
    (await hasPermission(actor.userId, "team:edit_any"))
  ) {
    return "owner";
  }
  return memberRole;
}

/**
 * Change a member's role. Refuses to demote the last owner.
 * With an actor, the role change is re-authorized against the locked rows.
 */
export async function updateTeamMemberRole(
  teamId: string,
  userId: string,
  role: TeamMemberRole,
  actor?: TeamMemberActor,
): Promise<UpdateTeamMemberRoleResult> {
  return db.transaction(async (tx): Promise<UpdateTeamMemberRoleResult> => {
    const ownerIds = await lockOwnerIds(tx, teamId);

    const currentRole = await lockTargetRole(tx, teamId, userId);
    if (!currentRole) return MEMBER_NOT_FOUND;

    if (actor) {
      const actingRole = await lockActingRole(
        tx,
        teamId,
        actor,
        userId,
        currentRole,
      );
      if (!canAssignTeamRole(actingRole, currentRole, role)) return FORBIDDEN;
    }

    if (
      currentRole === "owner" &&
      role !== "owner" &&
      ownerIds.filter((id) => id !== userId).length === 0
    ) {
      return LAST_OWNER;
    }

    const [member] = await tx
      .update(teamMembers)
      .set({ role })
      .where(memberWhere(teamId, userId))
      .returning();

    logger.info("Team member role updated", { teamId, userId, role });

    return { ok: true, member };
  });
}

/**
 * Remove a member from a team. Refuses to remove the last owner.
 * With an actor other than the member, the removal is re-authorized against the locked rows.
 */
export async function removeTeamMember(
  teamId: string,
  userId: string,
  actor?: TeamMemberActor,
): Promise<RemoveTeamMemberResult> {
  const result = await db.transaction(
    async (tx): Promise<RemoveTeamMemberResult> => {
      const ownerIds = await lockOwnerIds(tx, teamId);

      const currentRole = await lockTargetRole(tx, teamId, userId);
      if (!currentRole) return MEMBER_NOT_FOUND;

      // Leaving the team is allowed for any member
      if (actor && actor.userId !== userId) {
        const actingRole = await lockActingRole(
          tx,
          teamId,
          actor,
          userId,
          currentRole,
        );
        if (!canAssignTeamRole(actingRole, currentRole, null)) return FORBIDDEN;
      }

      if (
        currentRole === "owner" &&
        ownerIds.filter((id) => id !== userId).length === 0
      ) {
        return LAST_OWNER;
      }

      await tx.delete(teamMembers).where(memberWhere(teamId, userId));

      return { ok: true };
    },
  );

  if (result.ok) {
    logger.info("Team member removed", { teamId, userId });

    logEvent({
      eventType: "team_member_removed",
      userId,
      entityId: teamId,
      entityType: "team",
    });
  }

  return result;
}

/**
 * Enable the join link, or replace its token if already enabled.
 * Returns the new token, or null if the team does not exist.
 */
export async function enableOrRotateJoinLink(
  teamId: string,
): Promise<string | null> {
  const [updated] = await db
    .update(teams)
    .set({ joinToken: generateShareToken(), updatedAt: new Date() })
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(teams.id, teamId as any))
    .returning({ joinToken: teams.joinToken });

  return updated?.joinToken ?? null;
}

export async function disableJoinLink(teamId: string): Promise<boolean> {
  const updated = await db
    .update(teams)
    .set({ joinToken: null, updatedAt: new Date() })
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(teams.id, teamId as any))
    .returning({ id: teams.id });

  return updated.length > 0;
}

export async function setJoinLinkRole(
  teamId: string,
  role: TeamJoinLinkRole,
): Promise<boolean> {
  const updated = await db
    .update(teams)
    .set({ joinRole: role, updatedAt: new Date() })
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(teams.id, teamId as any))
    .returning({ id: teams.id });

  return updated.length > 0;
}

/**
 * Join a team via its join link. Existing members keep their current role.
 */
export async function joinTeamByToken(
  teamId: string,
  userId: string,
  token: string,
): Promise<JoinTeamResult> {
  const result = await db.transaction(async (tx): Promise<JoinTeamResult> => {
    const [team] = await tx
      .select({ joinToken: teams.joinToken, joinRole: teams.joinRole })
      .from(teams)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(teams.id, teamId as any))
      .for("share");

    // One response for missing team, disabled link and wrong token, like the join page
    if (!team?.joinToken || !tokensEqual(team.joinToken, token)) {
      return INVALID_JOIN_LINK;
    }

    const [inserted] = await tx
      .insert(teamMembers)
      .values({ teamId, userId, role: team.joinRole })
      .onConflictDoNothing({
        target: [teamMembers.teamId, teamMembers.userId],
      })
      .returning();

    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(teamMembers)
        .where(memberWhere(teamId, userId));
      return { ok: true, member: existing, alreadyMember: true };
    }

    await tx.delete(teamInvitations).where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(teamInvitations.teamId, teamId as any),
        eq(teamInvitations.userId, userId),
      ),
    );

    return { ok: true, member: inserted, alreadyMember: false };
  });

  if (result.ok && !result.alreadyMember) {
    logger.info("User joined team via link", {
      teamId,
      userId,
      role: result.member.role,
    });

    logEvent({
      eventType: "team_member_added",
      userId,
      entityId: teamId,
      entityType: "team",
      metadata: { via: "join_link" },
    });
  }

  return result;
}
