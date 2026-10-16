import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type DashboardMemberRole,
  dashboardMembers,
  dashboards,
  type TeamMemberRole,
  teamMembers,
} from "$lib/db/schema";
import {
  dashboardRoleRank,
  mapTeamRoleToDashboardRole,
  maxDashboardRole,
} from "$lib/roles";
import { isFollowingDashboard } from "$lib/server/followers";
import { hasPermission } from "$lib/server/permissions";

export type DashboardAccess = {
  exists: boolean;
  /** Personal owner; always false for team-owned dashboards. */
  isOwner: boolean;
  teamId: string | null;
  directRole: DashboardMemberRole | null;
  teamRole: TeamMemberRole | null;
  effectiveRole: DashboardMemberRole | null;
};

/**
 * Resolve a user's access to a dashboard (ownership, direct membership, team membership) in one query.
 */
export async function getDashboardAccess(
  userId: string,
  dashboardId: string,
): Promise<DashboardAccess> {
  const [row] = await db
    .select({
      ownerId: dashboards.ownerId,
      teamId: dashboards.teamId,
      directRole: dashboardMembers.role,
      teamRole: teamMembers.role,
    })
    .from(dashboards)
    .leftJoin(
      dashboardMembers,
      and(
        eq(dashboardMembers.dashboardId, dashboards.id),
        eq(dashboardMembers.userId, userId),
      ),
    )
    .leftJoin(
      teamMembers,
      and(
        eq(teamMembers.teamId, dashboards.teamId),
        eq(teamMembers.userId, userId),
      ),
    )
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboards.id, dashboardId as any));

  if (!row) {
    return {
      exists: false,
      isOwner: false,
      teamId: null,
      directRole: null,
      teamRole: null,
      effectiveRole: null,
    };
  }

  const teamId = row.teamId ?? null;
  const directRole = row.directRole ?? null;
  const teamRole = row.teamRole ?? null;

  return {
    exists: true,
    isOwner: teamId === null && row.ownerId === userId,
    teamId,
    directRole,
    teamRole,
    effectiveRole: maxDashboardRole(
      directRole,
      teamRole ? mapTeamRoleToDashboardRole(teamRole) : null,
    ),
  };
}

function hasDashboardRole(
  access: DashboardAccess,
  min: DashboardMemberRole,
): boolean {
  return (
    access.effectiveRole !== null &&
    dashboardRoleRank(access.effectiveRole) >= dashboardRoleRank(min)
  );
}

async function isDashboardOwner(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  return (await getDashboardAccess(userId, dashboardId)).isOwner;
}

export async function canEditDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  const access = await getDashboardAccess(userId, dashboardId);
  if (access.isOwner || hasDashboardRole(access, "editor")) return true;

  return hasPermission(userId, "dashboard:edit_any");
}

export async function canDeleteDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  const access = await getDashboardAccess(userId, dashboardId);
  if (access.isOwner || hasDashboardRole(access, "admin")) return true;

  return hasPermission(userId, "dashboard:delete_any");
}

export async function canManageDashboardMembers(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  const access = await getDashboardAccess(userId, dashboardId);
  if (access.isOwner || hasDashboardRole(access, "admin")) return true;

  return hasPermission(userId, "dashboard:edit_any");
}

export async function canViewDashboard(
  userId: string,
  dashboardId: string,
): Promise<boolean> {
  const access = await getDashboardAccess(userId, dashboardId);
  if (access.isOwner || access.effectiveRole) return true;

  if (await isFollowingDashboard(userId, dashboardId)) return true;

  return hasPermission(userId, "dashboard:edit_any");
}

export { isDashboardOwner };
