import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { type DashboardMember, dashboardMembers, users } from "$lib/db/schema";
import { logger } from "$lib/server/logger";

type MemberWithUser = DashboardMember & {
  username: string | null;
  name: string | null;
  image: string | null;
};

/**
 * Invite a user to a dashboard by username.
 */
export async function inviteDashboardUserByUsername(
  dashboardId: string,
  username: string,
  role: "viewer" | "editor" | "admin",
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

/**
 * Remove a member from a dashboard.
 */
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

  return result.length > 0;
}

/**
 * Get all members of a dashboard with user details.
 */
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
    .where(
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      eq(dashboardMembers.dashboardId, dashboardId as any),
    );

  return rows;
}
