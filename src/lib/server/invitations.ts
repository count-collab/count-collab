import { and, count as countFn, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type CounterInvitation,
  type CounterMemberRole,
  counterInvitations,
  counterMembers,
  counters,
  dashboardInvitations,
  dashboards,
  type TeamInvitation,
  type TeamMember,
  type TeamMemberRole,
  teamInvitations,
  teamMembers,
  teams,
  users,
} from "$lib/db/schema";
import { teamRoleRank } from "$lib/roles";
import { logEvent } from "$lib/server/events";
import { logger } from "$lib/server/logger";
import { emitInvitationCreated } from "$lib/utils/socket";

type InvitationWithUser = CounterInvitation & {
  username: string | null;
  name: string | null;
  image: string | null;
  inviterUsername: string | null;
};

type TeamInvitationWithUser = TeamInvitation & {
  username: string | null;
  name: string | null;
  image: string | null;
  inviterUsername: string | null;
};

const inviterAlias = db
  .select({ id: users.id, username: users.username })
  .from(users)
  .as("inviter");

const teamInvitationWithUserFields = {
  id: teamInvitations.id,
  teamId: teamInvitations.teamId,
  userId: teamInvitations.userId,
  invitedBy: teamInvitations.invitedBy,
  role: teamInvitations.role,
  createdAt: teamInvitations.createdAt,
  username: users.username,
  name: users.name,
  image: users.image,
  inviterUsername: inviterAlias.username,
};

function teamInvitationWhere(teamId: string, userId: string) {
  return and(
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    eq(teamInvitations.teamId, teamId as any),
    eq(teamInvitations.userId, userId),
  );
}

export async function createCounterInvitation(
  counterId: string,
  userId: string,
  role: CounterMemberRole,
  invitedBy: string,
): Promise<InvitationWithUser | null> {
  const [invitation] = await db
    .insert(counterInvitations)
    .values({ counterId, userId, role, invitedBy })
    .onConflictDoUpdate({
      target: [counterInvitations.counterId, counterInvitations.userId],
      set: { role, invitedBy },
    })
    .returning();

  if (!invitation) return null;

  const [withUser] = await db
    .select({
      id: counterInvitations.id,
      counterId: counterInvitations.counterId,
      userId: counterInvitations.userId,
      invitedBy: counterInvitations.invitedBy,
      role: counterInvitations.role,
      createdAt: counterInvitations.createdAt,
      username: users.username,
      name: users.name,
      image: users.image,
      inviterUsername: inviterAlias.username,
    })
    .from(counterInvitations)
    .innerJoin(users, eq(counterInvitations.userId, users.id))
    .leftJoin(inviterAlias, eq(counterInvitations.invitedBy, inviterAlias.id))
    .where(eq(counterInvitations.id, invitation.id));

  logger.info("Counter invitation created", {
    counterId,
    userId,
    role,
    invitedBy,
  });

  logEvent({
    eventType: "invitation_sent",
    userId: invitedBy,
    entityId: counterId,
    entityType: "invitation",
    metadata: { target_type: "counter", invited_user_id: userId, role },
  });

  return withUser ?? null;
}

export async function deleteCounterInvitation(
  counterId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .delete(counterInvitations)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterInvitations.counterId, counterId as any),
        eq(counterInvitations.userId, userId),
      ),
    )
    .returning();

  if (result.length > 0) {
    logEvent({
      eventType: "invitation_deleted",
      userId,
      entityId: counterId,
      entityType: "invitation",
      metadata: { target_type: "counter" },
    });
  }

  return result.length > 0;
}

export async function updateCounterInvitationRole(
  counterId: string,
  userId: string,
  role: CounterMemberRole,
): Promise<InvitationWithUser | null> {
  const [updated] = await db
    .update(counterInvitations)
    .set({ role })
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterInvitations.counterId, counterId as any),
        eq(counterInvitations.userId, userId),
      ),
    )
    .returning();

  if (!updated) return null;

  const [withUser] = await db
    .select({
      id: counterInvitations.id,
      counterId: counterInvitations.counterId,
      userId: counterInvitations.userId,
      invitedBy: counterInvitations.invitedBy,
      role: counterInvitations.role,
      createdAt: counterInvitations.createdAt,
      username: users.username,
      name: users.name,
      image: users.image,
      inviterUsername: inviterAlias.username,
    })
    .from(counterInvitations)
    .innerJoin(users, eq(counterInvitations.userId, users.id))
    .leftJoin(inviterAlias, eq(counterInvitations.invitedBy, inviterAlias.id))
    .where(eq(counterInvitations.id, updated.id));

  return withUser ?? null;
}

export async function getCounterInvitations(
  counterId: string,
): Promise<InvitationWithUser[]> {
  const rows = await db
    .select({
      id: counterInvitations.id,
      counterId: counterInvitations.counterId,
      userId: counterInvitations.userId,
      invitedBy: counterInvitations.invitedBy,
      role: counterInvitations.role,
      createdAt: counterInvitations.createdAt,
      username: users.username,
      name: users.name,
      image: users.image,
      inviterUsername: inviterAlias.username,
    })
    .from(counterInvitations)
    .innerJoin(users, eq(counterInvitations.userId, users.id))
    .leftJoin(inviterAlias, eq(counterInvitations.invitedBy, inviterAlias.id))
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counterInvitations.counterId, counterId as any));

  return rows;
}

export async function getUserPendingInvitations(userId: string) {
  const counterRows = await db
    .select({
      id: counterInvitations.id,
      counterId: counterInvitations.counterId,
      userId: counterInvitations.userId,
      invitedBy: counterInvitations.invitedBy,
      role: counterInvitations.role,
      createdAt: counterInvitations.createdAt,
      title: counters.title,
      inviterUsername: inviterAlias.username,
    })
    .from(counterInvitations)
    .innerJoin(
      counters,
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      eq(counterInvitations.counterId, counters.id as any),
    )
    .leftJoin(inviterAlias, eq(counterInvitations.invitedBy, inviterAlias.id))
    .where(eq(counterInvitations.userId, userId));

  const dashboardRows = await db
    .select({
      id: dashboardInvitations.id,
      dashboardId: dashboardInvitations.dashboardId,
      userId: dashboardInvitations.userId,
      invitedBy: dashboardInvitations.invitedBy,
      role: dashboardInvitations.role,
      createdAt: dashboardInvitations.createdAt,
      title: dashboards.title,
      inviterUsername: inviterAlias.username,
    })
    .from(dashboardInvitations)
    .innerJoin(
      dashboards,
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      eq(dashboardInvitations.dashboardId, dashboards.id as any),
    )
    .leftJoin(inviterAlias, eq(dashboardInvitations.invitedBy, inviterAlias.id))
    .where(eq(dashboardInvitations.userId, userId));

  const teamRows = await db
    .select({
      id: teamInvitations.id,
      teamId: teamInvitations.teamId,
      userId: teamInvitations.userId,
      invitedBy: teamInvitations.invitedBy,
      role: teamInvitations.role,
      createdAt: teamInvitations.createdAt,
      title: teams.name,
      inviterUsername: inviterAlias.username,
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
    .leftJoin(inviterAlias, eq(teamInvitations.invitedBy, inviterAlias.id))
    .where(eq(teamInvitations.userId, userId));

  return [
    ...counterRows.map((r) => ({
      ...r,
      type: "counter" as const,
      resourceId: r.counterId,
    })),
    ...dashboardRows.map((r) => ({
      ...r,
      type: "dashboard" as const,
      resourceId: r.dashboardId,
    })),
    ...teamRows.map((r) => ({
      ...r,
      type: "team" as const,
      resourceId: r.teamId,
    })),
  ];
}

export async function acceptCounterInvitation(
  counterId: string,
  userId: string,
) {
  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(counterInvitations)
      .where(
        and(
          // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
          eq(counterInvitations.counterId, counterId as any),
          eq(counterInvitations.userId, userId),
        ),
      );

    if (!invitation) return null;

    const [member] = await tx
      .insert(counterMembers)
      .values({
        counterId,
        userId,
        role: invitation.role,
      })
      .onConflictDoUpdate({
        target: [counterMembers.counterId, counterMembers.userId],
        set: { role: invitation.role },
      })
      .returning();

    await tx
      .delete(counterInvitations)
      .where(eq(counterInvitations.id, invitation.id));

    logger.info("Counter invitation accepted", { counterId, userId });

    logEvent({
      eventType: "invitation_accepted",
      userId,
      entityId: counterId,
      entityType: "invitation",
      metadata: { target_type: "counter", role: invitation.role },
    });

    return member;
  });
}

export async function hasCounterPendingInvitation(
  counterId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: counterInvitations.id })
    .from(counterInvitations)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterInvitations.counterId, counterId as any),
        eq(counterInvitations.userId, userId),
      ),
    );
  return !!row;
}

export async function getUserPendingInvitationCount(
  userId: string,
): Promise<number> {
  const [counterCount] = await db
    .select({ count: countFn() })
    .from(counterInvitations)
    .where(eq(counterInvitations.userId, userId));

  const [dashboardCount] = await db
    .select({ count: countFn() })
    .from(dashboardInvitations)
    .where(eq(dashboardInvitations.userId, userId));

  const [teamCount] = await db
    .select({ count: countFn() })
    .from(teamInvitations)
    .where(eq(teamInvitations.userId, userId));

  return (
    Number(counterCount?.count ?? 0) +
    Number(dashboardCount?.count ?? 0) +
    Number(teamCount?.count ?? 0)
  );
}

// ── Team invitations ────────────────────────────────────────────

export async function createTeamInvitation(
  teamId: string,
  userId: string,
  role: TeamMemberRole,
  invitedBy: string,
): Promise<TeamInvitationWithUser | null> {
  const [invitation] = await db
    .insert(teamInvitations)
    .values({ teamId, userId, role, invitedBy })
    .onConflictDoUpdate({
      target: [teamInvitations.teamId, teamInvitations.userId],
      set: { role, invitedBy },
    })
    .returning();

  if (!invitation) return null;

  const [row] = await db
    .select({ ...teamInvitationWithUserFields, teamName: teams.name })
    .from(teamInvitations)
    .innerJoin(users, eq(teamInvitations.userId, users.id))
    .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
    .leftJoin(inviterAlias, eq(teamInvitations.invitedBy, inviterAlias.id))
    .where(eq(teamInvitations.id, invitation.id));

  logger.info("Team invitation created", { teamId, userId, role, invitedBy });

  logEvent({
    eventType: "invitation_sent",
    userId: invitedBy,
    entityId: teamId,
    entityType: "invitation",
    metadata: { target_type: "team", invited_user_id: userId, role },
  });

  if (!row) return null;

  const { teamName, ...withUser } = row;

  emitInvitationCreated(userId, {
    type: "team",
    entityId: teamId,
    entityTitle: teamName,
    role,
    inviterUsername: withUser.inviterUsername,
  });

  return withUser;
}

export async function deleteTeamInvitation(
  teamId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .delete(teamInvitations)
    .where(teamInvitationWhere(teamId, userId))
    .returning();

  if (result.length > 0) {
    logEvent({
      eventType: "invitation_deleted",
      userId,
      entityId: teamId,
      entityType: "invitation",
      metadata: { target_type: "team" },
    });
  }

  return result.length > 0;
}

export async function updateTeamInvitationRole(
  teamId: string,
  userId: string,
  role: TeamMemberRole,
): Promise<TeamInvitationWithUser | null> {
  const [updated] = await db
    .update(teamInvitations)
    .set({ role })
    .where(teamInvitationWhere(teamId, userId))
    .returning();

  if (!updated) return null;

  const [withUser] = await db
    .select(teamInvitationWithUserFields)
    .from(teamInvitations)
    .innerJoin(users, eq(teamInvitations.userId, users.id))
    .leftJoin(inviterAlias, eq(teamInvitations.invitedBy, inviterAlias.id))
    .where(eq(teamInvitations.id, updated.id));

  return withUser ?? null;
}

export async function getTeamInvitations(
  teamId: string,
): Promise<TeamInvitationWithUser[]> {
  return (
    db
      .select(teamInvitationWithUserFields)
      .from(teamInvitations)
      .innerJoin(users, eq(teamInvitations.userId, users.id))
      .leftJoin(inviterAlias, eq(teamInvitations.invitedBy, inviterAlias.id))
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(teamInvitations.teamId, teamId as any))
  );
}

/**
 * Accept a team invitation. An existing membership is never downgraded.
 */
export async function acceptTeamInvitation(
  teamId: string,
  userId: string,
): Promise<TeamMember | null> {
  const result = await db.transaction(async (tx) => {
    // Serializes with deleteTeam's FOR UPDATE so the team can't vanish mid-accept
    const [team] = await tx
      .select({ id: teams.id })
      .from(teams)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(teams.id, teamId as any))
      .for("share");

    if (!team) return null;

    // Concurrent accepts of the same invitation serialize here
    const [invitation] = await tx
      .select()
      .from(teamInvitations)
      .where(teamInvitationWhere(teamId, userId))
      .for("update");

    if (!invitation) return null;

    const memberWhere = and(
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      eq(teamMembers.teamId, teamId as any),
      eq(teamMembers.userId, userId),
    );

    let [member] = await tx
      .select()
      .from(teamMembers)
      .where(memberWhere)
      .for("update");

    let added = false;
    if (!member) {
      [member] = await tx
        .insert(teamMembers)
        .values({ teamId, userId, role: invitation.role })
        .onConflictDoNothing({
          target: [teamMembers.teamId, teamMembers.userId],
        })
        .returning();
      added = !!member;
    }

    if (!member) {
      // Joined concurrently (e.g. via join link); the new row is visible to this statement
      [member] = await tx
        .select()
        .from(teamMembers)
        .where(memberWhere)
        .for("update");
      // Removed again in between: roll back and let the user retry
      if (!member) return null;
    }

    if (!added && teamRoleRank(invitation.role) > teamRoleRank(member.role)) {
      [member] = await tx
        .update(teamMembers)
        .set({ role: invitation.role })
        .where(eq(teamMembers.id, member.id))
        .returning();
    }

    await tx
      .delete(teamInvitations)
      .where(eq(teamInvitations.id, invitation.id));

    return { member, role: invitation.role, added };
  });

  if (!result) return null;

  logger.info("Team invitation accepted", { teamId, userId });

  logEvent({
    eventType: "invitation_accepted",
    userId,
    entityId: teamId,
    entityType: "invitation",
    metadata: { target_type: "team", role: result.role },
  });

  if (result.added) {
    logEvent({
      eventType: "team_member_added",
      userId,
      entityId: teamId,
      entityType: "team",
      metadata: { via: "invitation" },
    });
  }

  return result.member;
}
