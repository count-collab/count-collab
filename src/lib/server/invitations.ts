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
  users,
} from "$lib/db/schema";
import { logger } from "$lib/server/logger";

type InvitationWithUser = CounterInvitation & {
  username: string | null;
  name: string | null;
  image: string | null;
  inviterUsername: string | null;
};

const inviterAlias = db
  .select({ id: users.id, username: users.username })
  .from(users)
  .as("inviter");

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

  return Number(counterCount?.count ?? 0) + Number(dashboardCount?.count ?? 0);
}
