import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { type TeamMemberRole, teamMembers } from "$lib/db/schema";
import { isTeamRoleAtLeast } from "$lib/roles";
import { hasPermission } from "$lib/server/permissions";

/**
 * Get the team-level role for a user (from team_members table).
 */
export async function getUserTeamRole(
  userId: string,
  teamId: string,
): Promise<TeamMemberRole | null> {
  const [row] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(teamMembers.teamId, teamId as any),
        eq(teamMembers.userId, userId),
      ),
    );
  return row?.role ?? null;
}

/**
 * Check if a user can view a team.
 * Allowed if: any team member, or global team:edit_any permission.
 */
export async function canViewTeam(
  userId: string,
  teamId: string,
): Promise<boolean> {
  if (await getUserTeamRole(userId, teamId)) return true;

  return hasPermission(userId, "team:edit_any");
}

/**
 * Check if a user can create/edit team-owned counters and dashboards.
 * Allowed if: team editor+, or global team:edit_any permission.
 */
export async function canEditTeamResources(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const role = await getUserTeamRole(userId, teamId);
  if (isTeamRoleAtLeast(role, "editor")) return true;

  return hasPermission(userId, "team:edit_any");
}

/**
 * Check if a user can manage team settings and members.
 * Allowed if: team admin+, or global team:edit_any permission.
 */
export async function canManageTeam(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const role = await getUserTeamRole(userId, teamId);
  if (isTeamRoleAtLeast(role, "admin")) return true;

  return hasPermission(userId, "team:edit_any");
}

/**
 * Check if a user can delete a team.
 * Allowed if: team owner, or global team:delete_any permission.
 */
export async function canDeleteTeam(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const role = await getUserTeamRole(userId, teamId);
  if (role === "owner") return true;

  return hasPermission(userId, "team:delete_any");
}

/**
 * Team role to use when checking member-management actions (e.g. canAssignTeamRole).
 * Platform users with team:edit_any act as owner.
 */
export async function getActingTeamRole(
  userId: string,
  teamId: string,
): Promise<TeamMemberRole | null> {
  const role = await getUserTeamRole(userId, teamId);
  if (role === "owner") return role;

  if (await hasPermission(userId, "team:edit_any")) return "owner";

  return role;
}
