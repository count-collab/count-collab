import { and, count as countFn, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type CounterInvitation,
  type CounterMemberRole,
  counterInvitations,
  counterMembers,
  counters,
  dashboardInvitations,
  dashboards,
  platformEvents,
  type TeamInvitation,
  type TeamMember,
  type TeamMemberRole,
  teamInvitations,
  teamMembers,
  teams,
  users,
} from "$lib/db/schema";
import { canAssignTeamRole, teamRoleRank } from "$lib/roles";
import { logEvent, logEventInTx } from "$lib/server/events";
import { logger } from "$lib/server/logger";
import { hasPermission } from "$lib/server/permissions";
import { TeamLimitError } from "$lib/server/team-limits";
import {
  enforceMemberCap,
  INVITATION_COOLDOWN_SECONDS,
  INVITATION_EXPIRY_MS,
  MAX_INVITATIONS_PER_INVITER_PER_DAY,
  MAX_PENDING_INVITATIONS_PER_TEAM,
  MAX_PENDING_INVITATIONS_PER_USER,
} from "$lib/server/teams";
import { emitInvitationCreated } from "$lib/utils/socket";

const DAY_MS = 24 * 60 * 60 * 1000;

function invitationCutoff(): Date {
  return new Date(Date.now() - INVITATION_EXPIRY_MS);
}

type InvitationWithUser = CounterInvitation & {
  username: string | null;
  image: string | null;
  inviterUsername: string | null;
};

type TeamInvitationWithUser = TeamInvitation & {
  username: string | null;
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
    .where(
      and(
        eq(teamInvitations.userId, userId),
        gt(teamInvitations.createdAt, invitationCutoff()),
      ),
    );

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
    .where(
      and(
        eq(teamInvitations.userId, userId),
        gt(teamInvitations.createdAt, invitationCutoff()),
      ),
    );

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
  const invitation = await db.transaction(async (tx) => {
    // Lock order (team, then inviter) matches deleteUser; serializes cap checks
    const [team] = await tx
      .select({ id: teams.id })
      .from(teams)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(teams.id, teamId as any))
      .for("update");
    if (!team) return null;

    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, invitedBy))
      .for("update");

    const cutoff = invitationCutoff();

    const [existing] = await tx
      .select()
      .from(teamInvitations)
      .where(teamInvitationWhere(teamId, userId))
      .for("update");
    const stillPending = !!existing && existing.createdAt > cutoff;

    if (stillPending) {
      const waitMs =
        INVITATION_COOLDOWN_SECONDS * 1000 -
        (Date.now() - existing.createdAt.getTime());
      if (waitMs > 0) {
        throw new TeamLimitError(
          "invitation_cooldown",
          429,
          "This user was invited moments ago. Please wait before inviting again",
          Math.ceil(waitMs / 1000),
        );
      }
    } else {
      const [{ total: forTeam }] = await tx
        .select({ total: countFn() })
        .from(teamInvitations)
        .where(
          and(
            // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
            eq(teamInvitations.teamId, teamId as any),
            gt(teamInvitations.createdAt, cutoff),
          ),
        );
      if (Number(forTeam) >= MAX_PENDING_INVITATIONS_PER_TEAM) {
        throw new TeamLimitError(
          "pending_team_limit",
          409,
          "This team has too many pending invitations",
        );
      }

      const [{ total: forUser }] = await tx
        .select({ total: countFn() })
        .from(teamInvitations)
        .where(
          and(
            eq(teamInvitations.userId, userId),
            gt(teamInvitations.createdAt, cutoff),
          ),
        );
      if (Number(forUser) >= MAX_PENDING_INVITATIONS_PER_USER) {
        throw new TeamLimitError(
          "pending_recipient_limit",
          409,
          "This user has too many pending team invitations",
        );
      }
    }

    // Sent events outlive accepted/declined invitations, unlike the rows
    const [{ total: sentToday }] = await tx
      .select({ total: countFn() })
      .from(platformEvents)
      .where(
        and(
          eq(platformEvents.userId, invitedBy),
          eq(platformEvents.eventType, "invitation_sent"),
          sql`${platformEvents.metadata}->>'target_type' = 'team'`,
          gte(platformEvents.createdAt, new Date(Date.now() - DAY_MS)),
        ),
      );
    if (Number(sentToday) >= MAX_INVITATIONS_PER_INVITER_PER_DAY) {
      throw new TeamLimitError(
        "daily_invitation_limit",
        429,
        "You have sent too many team invitations today",
        DAY_MS / 1000,
      );
    }

    // createdAt is refreshed so re-invites restart expiry and cooldown
    const [upserted] = await tx
      .insert(teamInvitations)
      .values({ teamId, userId, role, invitedBy })
      .onConflictDoUpdate({
        target: [teamInvitations.teamId, teamInvitations.userId],
        set: { role, invitedBy, createdAt: new Date() },
      })
      .returning();

    if (upserted) {
      await logEventInTx(tx, {
        eventType: "invitation_sent",
        userId: invitedBy,
        entityId: teamId,
        entityType: "invitation",
        metadata: { target_type: "team", invited_user_id: userId, role },
      });
    }

    return upserted ?? null;
  });

  if (!invitation) return null;

  const [row] = await db
    .select({ ...teamInvitationWithUserFields, teamName: teams.name })
    .from(teamInvitations)
    .innerJoin(users, eq(teamInvitations.userId, users.id))
    .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
    .leftJoin(inviterAlias, eq(teamInvitations.invitedBy, inviterAlias.id))
    .where(eq(teamInvitations.id, invitation.id));

  logger.info("Team invitation created", { teamId, userId, role, invitedBy });

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
 * Expired invitations and ones whose inviter can no longer assign the role are
 * purged and reported like an unknown invitation.
 */
export async function acceptTeamInvitation(
  teamId: string,
  userId: string,
): Promise<TeamMember | null> {
  const result = await db.transaction(async (tx) => {
    // The update lock serializes with deleteTeam and keeps the member cap race-free
    const [team] = await tx
      .select({ id: teams.id })
      .from(teams)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(teams.id, teamId as any))
      .for("update");

    if (!team) return null;

    // Concurrent accepts of the same invitation serialize here
    const [invitation] = await tx
      .select()
      .from(teamInvitations)
      .where(teamInvitationWhere(teamId, userId))
      .for("update");

    if (!invitation) return null;

    const discardInvitation = async () => {
      await tx
        .delete(teamInvitations)
        .where(eq(teamInvitations.id, invitation.id));
      return null;
    };

    if (invitation.createdAt <= invitationCutoff()) return discardInvitation();

    if (!invitation.invitedBy) return discardInvitation();
    const [inviter] = await tx
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
          eq(teamMembers.teamId, teamId as any),
          eq(teamMembers.userId, invitation.invitedBy),
        ),
      )
      .for("share");
    // Platform admins invite as owner without being members (see lockActingRole)
    const inviterRole =
      inviter?.role ??
      ((await hasPermission(invitation.invitedBy, "team:edit_any"))
        ? ("owner" as const)
        : null);
    if (!canAssignTeamRole(inviterRole, null, invitation.role)) {
      return discardInvitation();
    }

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

    if (added) await enforceMemberCap(tx, teamId);

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
