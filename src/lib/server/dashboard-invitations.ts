import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type DashboardInvitation,
  type DashboardMemberRole,
  dashboardInvitations,
  dashboardMembers,
  users,
} from "$lib/db/schema";
import { logger } from "$lib/server/logger";

type InvitationWithUser = DashboardInvitation & {
  username: string | null;
  name: string | null;
  image: string | null;
  inviterUsername: string | null;
};

const inviterAlias = db
  .select({ id: users.id, username: users.username })
  .from(users)
  .as("inviter");

export async function createDashboardInvitation(
  dashboardId: string,
  userId: string,
  role: DashboardMemberRole,
  invitedBy: string,
): Promise<InvitationWithUser | null> {
  const [invitation] = await db
    .insert(dashboardInvitations)
    .values({ dashboardId, userId, role, invitedBy })
    .onConflictDoUpdate({
      target: [dashboardInvitations.dashboardId, dashboardInvitations.userId],
      set: { role, invitedBy },
    })
    .returning();

  if (!invitation) return null;

  const [withUser] = await db
    .select({
      id: dashboardInvitations.id,
      dashboardId: dashboardInvitations.dashboardId,
      userId: dashboardInvitations.userId,
      invitedBy: dashboardInvitations.invitedBy,
      role: dashboardInvitations.role,
      createdAt: dashboardInvitations.createdAt,
      username: users.username,
      name: users.name,
      image: users.image,
      inviterUsername: inviterAlias.username,
    })
    .from(dashboardInvitations)
    .innerJoin(users, eq(dashboardInvitations.userId, users.id))
    .leftJoin(inviterAlias, eq(dashboardInvitations.invitedBy, inviterAlias.id))
    .where(eq(dashboardInvitations.id, invitation.id));

  logger.info("Dashboard invitation created", {
    dashboardId,
    userId,
    role,
    invitedBy,
  });

  return withUser ?? null;
}

export async function deleteDashboardInvitation(
  dashboardId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .delete(dashboardInvitations)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardInvitations.dashboardId, dashboardId as any),
        eq(dashboardInvitations.userId, userId),
      ),
    )
    .returning();

  return result.length > 0;
}

export async function updateDashboardInvitationRole(
  dashboardId: string,
  userId: string,
  role: DashboardMemberRole,
): Promise<InvitationWithUser | null> {
  const [updated] = await db
    .update(dashboardInvitations)
    .set({ role })
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardInvitations.dashboardId, dashboardId as any),
        eq(dashboardInvitations.userId, userId),
      ),
    )
    .returning();

  if (!updated) return null;

  const [withUser] = await db
    .select({
      id: dashboardInvitations.id,
      dashboardId: dashboardInvitations.dashboardId,
      userId: dashboardInvitations.userId,
      invitedBy: dashboardInvitations.invitedBy,
      role: dashboardInvitations.role,
      createdAt: dashboardInvitations.createdAt,
      username: users.username,
      name: users.name,
      image: users.image,
      inviterUsername: inviterAlias.username,
    })
    .from(dashboardInvitations)
    .innerJoin(users, eq(dashboardInvitations.userId, users.id))
    .leftJoin(inviterAlias, eq(dashboardInvitations.invitedBy, inviterAlias.id))
    .where(eq(dashboardInvitations.id, updated.id));

  return withUser ?? null;
}

export async function getDashboardInvitations(
  dashboardId: string,
): Promise<InvitationWithUser[]> {
  const rows = await db
    .select({
      id: dashboardInvitations.id,
      dashboardId: dashboardInvitations.dashboardId,
      userId: dashboardInvitations.userId,
      invitedBy: dashboardInvitations.invitedBy,
      role: dashboardInvitations.role,
      createdAt: dashboardInvitations.createdAt,
      username: users.username,
      name: users.name,
      image: users.image,
      inviterUsername: inviterAlias.username,
    })
    .from(dashboardInvitations)
    .innerJoin(users, eq(dashboardInvitations.userId, users.id))
    .leftJoin(inviterAlias, eq(dashboardInvitations.invitedBy, inviterAlias.id))
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardInvitations.dashboardId, dashboardId as any));

  return rows;
}

export async function acceptDashboardInvitation(
  dashboardId: string,
  userId: string,
) {
  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(dashboardInvitations)
      .where(
        and(
          // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
          eq(dashboardInvitations.dashboardId, dashboardId as any),
          eq(dashboardInvitations.userId, userId),
        ),
      );

    if (!invitation) return null;

    const [member] = await tx
      .insert(dashboardMembers)
      .values({
        dashboardId,
        userId,
        role: invitation.role,
      })
      .onConflictDoUpdate({
        target: [dashboardMembers.dashboardId, dashboardMembers.userId],
        set: { role: invitation.role },
      })
      .returning();

    await tx
      .delete(dashboardInvitations)
      .where(eq(dashboardInvitations.id, invitation.id));

    logger.info("Dashboard invitation accepted", { dashboardId, userId });

    return member;
  });
}

export async function hasDashboardPendingInvitation(
  dashboardId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: dashboardInvitations.id })
    .from(dashboardInvitations)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardInvitations.dashboardId, dashboardId as any),
        eq(dashboardInvitations.userId, userId),
      ),
    );
  return !!row;
}
