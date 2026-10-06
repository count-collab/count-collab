import type {
  CounterMemberRole,
  DashboardMemberRole,
  TeamMemberRole,
} from "$lib/db/schema";

// Defined locally (not imported as values) so drizzle stays out of the client bundle.
const counterRoleOrder: readonly CounterMemberRole[] = [
  "viewer",
  "incrementer",
  "editor",
  "admin",
];

const dashboardRoleOrder: readonly DashboardMemberRole[] = [
  "viewer",
  "editor",
  "admin",
];

export const teamRoleOrder: readonly TeamMemberRole[] = [
  "viewer",
  "incrementer",
  "editor",
  "admin",
  "owner",
];

export const teamRoleLabels: Record<TeamMemberRole, string> = {
  viewer: "Viewer",
  incrementer: "Incrementer",
  editor: "Editor",
  admin: "Admin",
  owner: "Owner",
};

export function counterRoleRank(role: CounterMemberRole): number {
  return counterRoleOrder.indexOf(role);
}

export function dashboardRoleRank(role: DashboardMemberRole): number {
  return dashboardRoleOrder.indexOf(role);
}

export function teamRoleRank(role: TeamMemberRole): number {
  return teamRoleOrder.indexOf(role);
}

export function mapTeamRoleToCounterRole(
  role: TeamMemberRole,
): CounterMemberRole {
  return role === "owner" ? "admin" : role;
}

export function mapTeamRoleToDashboardRole(
  role: TeamMemberRole,
): DashboardMemberRole {
  switch (role) {
    case "viewer":
    case "incrementer":
      return "viewer";
    case "editor":
      return "editor";
    case "admin":
    case "owner":
      return "admin";
  }
}

export function maxCounterRole(
  a: CounterMemberRole | null,
  b: CounterMemberRole | null,
): CounterMemberRole | null {
  if (!a) return b;
  if (!b) return a;
  return counterRoleRank(a) >= counterRoleRank(b) ? a : b;
}

export function maxDashboardRole(
  a: DashboardMemberRole | null,
  b: DashboardMemberRole | null,
): DashboardMemberRole | null {
  if (!a) return b;
  if (!b) return a;
  return dashboardRoleRank(a) >= dashboardRoleRank(b) ? a : b;
}

export function isTeamRoleAtLeast(
  role: TeamMemberRole | null,
  min: TeamMemberRole,
): boolean {
  if (!role) return false;
  return teamRoleRank(role) >= teamRoleRank(min);
}

/**
 * Whether `actorRole` may change a member from `currentRole` to `newRole`.
 * null currentRole = new invite, null newRole = removal.
 */
export function canAssignTeamRole(
  actorRole: TeamMemberRole | null,
  currentRole: TeamMemberRole | null,
  newRole: TeamMemberRole | null,
): boolean {
  if (!isTeamRoleAtLeast(actorRole, "admin")) return false;
  if (currentRole === null && newRole === null) return false;
  if (currentRole === "owner" || newRole === "owner") {
    return actorRole === "owner";
  }
  return true;
}
