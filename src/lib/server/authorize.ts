import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type CounterMemberRole,
  counterMembers,
  counters,
  type TeamMemberRole,
  teamMembers,
} from "$lib/db/schema";
import {
  counterRoleRank,
  mapTeamRoleToCounterRole,
  maxCounterRole,
} from "$lib/roles";
import { isFollowingCounter } from "$lib/server/followers";
import { hasPermission } from "$lib/server/permissions";

export type CounterAccess = {
  exists: boolean;
  /** Personal owner; always false for team-owned counters. */
  isOwner: boolean;
  teamId: string | null;
  directRole: CounterMemberRole | null;
  teamRole: TeamMemberRole | null;
  effectiveRole: CounterMemberRole | null;
};

/**
 * Resolve a user's access to a counter (ownership, direct membership, team membership) in one query.
 */
export async function getCounterAccess(
  userId: string,
  counterId: string,
): Promise<CounterAccess> {
  const [row] = await db
    .select({
      ownerId: counters.ownerId,
      teamId: counters.teamId,
      directRole: counterMembers.role,
      teamRole: teamMembers.role,
    })
    .from(counters)
    .leftJoin(
      counterMembers,
      and(
        eq(counterMembers.counterId, counters.id),
        eq(counterMembers.userId, userId),
      ),
    )
    .leftJoin(
      teamMembers,
      and(
        eq(teamMembers.teamId, counters.teamId),
        eq(teamMembers.userId, userId),
      ),
    )
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counters.id, counterId as any));

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
    effectiveRole: maxCounterRole(
      directRole,
      teamRole ? mapTeamRoleToCounterRole(teamRole) : null,
    ),
  };
}

function hasCounterRole(
  access: CounterAccess,
  min: CounterMemberRole,
): boolean {
  return (
    access.effectiveRole !== null &&
    counterRoleRank(access.effectiveRole) >= counterRoleRank(min)
  );
}

/**
 * Check if a user can increment a counter.
 * Allowed if: owner, effective role incrementer+, or global counter:edit_any permission.
 */
export async function canIncrementCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  const access = await getCounterAccess(userId, counterId);
  if (access.isOwner || hasCounterRole(access, "incrementer")) return true;

  return hasPermission(userId, "counter:edit_any");
}

/**
 * Check if a user can edit a counter.
 * Allowed if: owner, effective role editor+, or global counter:edit_any permission.
 */
export async function canEditCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  const access = await getCounterAccess(userId, counterId);
  if (access.isOwner || hasCounterRole(access, "editor")) return true;

  return hasPermission(userId, "counter:edit_any");
}

/**
 * Check if a user can delete a counter.
 * Allowed if: owner, effective role admin, or global counter:delete_any permission.
 */
export async function canDeleteCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  const access = await getCounterAccess(userId, counterId);
  if (access.isOwner || hasCounterRole(access, "admin")) return true;

  return hasPermission(userId, "counter:delete_any");
}

/**
 * Check if a user can manage members of a counter.
 * Allowed if: owner, effective role admin, or global counter:edit_any permission.
 */
export async function canManageMembers(
  userId: string,
  counterId: string,
): Promise<boolean> {
  const access = await getCounterAccess(userId, counterId);
  if (access.isOwner || hasCounterRole(access, "admin")) return true;

  return hasPermission(userId, "counter:edit_any");
}

/**
 * Check if a user can view a private counter.
 * Allowed if: owner, any effective role, follower, or global counter:edit_any permission.
 */
export async function canViewPrivateCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  const access = await getCounterAccess(userId, counterId);
  if (access.isOwner || access.effectiveRole) return true;

  if (await isFollowingCounter(userId, counterId)) return true;

  return hasPermission(userId, "counter:edit_any");
}

export type PrivateIncrementAccess = "allowed" | "forbidden" | "not_found";

/**
 * Resolve increment access to a private counter for a signed-in user without a valid share token.
 * Incrementer+ (or owner/global permission) → allowed; viewer role → forbidden;
 * otherwise followers → allowed; everyone else → not_found.
 */
export async function canIncrementPrivateCounter(
  userId: string,
  counterId: string,
): Promise<PrivateIncrementAccess> {
  const access = await getCounterAccess(userId, counterId);
  if (!access.exists) return "not_found";
  if (access.isOwner || hasCounterRole(access, "incrementer")) return "allowed";
  if (await hasPermission(userId, "counter:edit_any")) return "allowed";
  if (access.effectiveRole) return "forbidden";
  if (await isFollowingCounter(userId, counterId)) return "allowed";
  return "not_found";
}
