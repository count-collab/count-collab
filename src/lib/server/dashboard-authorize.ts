import { eq } from "drizzle-orm";
import { db } from "$lib/db";
import { type DashboardMemberRole, dashboards } from "$lib/db/schema";
import { getUserDashboardRole } from "$lib/server/dashboard-members";
import { hasPermission } from "$lib/server/permissions";

const dashboardEditRoles: DashboardMemberRole[] = ["editor", "admin"];

async function isDashboardOwner(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ ownerId: dashboards.ownerId })
    .from(dashboards)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboards.id, dashboardId as any));
  return row?.ownerId === userId;
}

export async function canEditDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  if (await isDashboardOwner(userId, dashboardId)) return true;

  const memberRole = await getUserDashboardRole(userId, dashboardId);
  if (memberRole && dashboardEditRoles.includes(memberRole)) return true;

  return hasPermission(userId, "dashboard:edit_any");
}

export async function canDeleteDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  if (await isDashboardOwner(userId, dashboardId)) return true;

  const memberRole = await getUserDashboardRole(userId, dashboardId);
  if (memberRole === "admin") return true;

  return hasPermission(userId, "dashboard:delete_any");
}

export async function canManageDashboardMembers(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  if (await isDashboardOwner(userId, dashboardId)) return true;

  const memberRole = await getUserDashboardRole(userId, dashboardId);
  if (memberRole === "admin") return true;

  return hasPermission(userId, "dashboard:edit_any");
}

export async function canViewDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  if (await isDashboardOwner(userId, dashboardId)) return true;

  const memberRole = await getUserDashboardRole(userId, dashboardId);
  if (memberRole) return true;

  return hasPermission(userId, "dashboard:edit_any");
}

export { isDashboardOwner };
