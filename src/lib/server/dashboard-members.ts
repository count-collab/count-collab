import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type DashboardMember,
  type DashboardMemberRole,
  dashboardMembers,
  users,
} from "$lib/db/schema";
import { logEvent } from "$lib/server/events";
import { logger } from "$lib/server/logger";

type MemberWithUser = DashboardMember & {
  username: string | null;
  name: string | null;
  image: string | null;
};

export async function inviteUserByUsername(
  dashboardId: string,
  username: string,
  role: DashboardMemberRole,
): Promise<DashboardMember | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));

  if (!user) return null;

  const [member] = await db
    .insert(dashboardMembers)
    .values({
      dashboardId,
      userId: user.id,
      role,
    })
    .onConflictDoUpdate({
      target: [dashboardMembers.dashboardId, dashboardMembers.userId],
      set: { role },
    })
    .returning();

  logger.info("User invited to dashboard", {
    dashboardId,
    username,
    role,
    userId: user.id,
  });

  return member;
}

export async function removeDashboardMember(
  dashboardId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .delete(dashboardMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardMembers.dashboardId, dashboardId as any),
        eq(dashboardMembers.userId, userId),
      ),
    )
    .returning();

  if (result.length > 0) {
    logEvent({
      eventType: "member_removed",
      userId,
      entityId: dashboardId,
      entityType: "member",
      metadata: { target_type: "dashboard" },
    });
  }

  return result.length > 0;
}

export async function updateDashboardMemberRole(
  dashboardId: string,
  userId: string,
  role: DashboardMemberRole,
): Promise<DashboardMember | null> {
  const [updated] = await db
    .update(dashboardMembers)
    .set({ role })
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardMembers.dashboardId, dashboardId as any),
        eq(dashboardMembers.userId, userId),
      ),
    )
    .returning();

  return updated ?? null;
}

export async function getDashboardMembers(
  dashboardId: string,
): Promise<MemberWithUser[]> {
  const rows = await db
    .select({
      id: dashboardMembers.id,
      dashboardId: dashboardMembers.dashboardId,
      userId: dashboardMembers.userId,
      role: dashboardMembers.role,
      invitedAt: dashboardMembers.invitedAt,
      username: users.username,
      name: users.name,
      image: users.image,
    })
    .from(dashboardMembers)
    .innerJoin(users, eq(dashboardMembers.userId, users.id))
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardMembers.dashboardId, dashboardId as any));

  return rows;
}

export async function getUserDashboardRole(
  userId: string,
  dashboardId: string,
): Promise<DashboardMemberRole | null> {
  const [row] = await db
    .select({ role: dashboardMembers.role })
    .from(dashboardMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardMembers.dashboardId, dashboardId as any),
        eq(dashboardMembers.userId, userId),
      ),
    );
  return row?.role ?? null;
}
