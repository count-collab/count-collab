import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type CounterMemberRole,
  counterMembers,
  counters,
} from "$lib/db/schema";
import { hasPermission } from "$lib/server/permissions";

const counterIncrementRoles: CounterMemberRole[] = [
  "incrementer",
  "editor",
  "admin",
];

const counterEditRoles: CounterMemberRole[] = ["editor", "admin"];

/**
 * Get the counter-level role for a user (from counter_members table).
 */
async function getCounterMemberRole(
  userId: string,
  counterId: string,
): Promise<CounterMemberRole | null> {
  const [row] = await db
    .select({ role: counterMembers.role })
    .from(counterMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterMembers.counterId, counterId as any),
        eq(counterMembers.userId, userId),
      ),
    );
  return row?.role ?? null;
}

/**
 * Check if a user is the owner of a counter.
 */
async function isCounterOwner(
  userId: string,
  counterId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ ownerId: counters.ownerId })
    .from(counters)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counters.id, counterId as any));
  return row?.ownerId === userId;
}

/**
 * Check if a user can increment a counter.
 * Allowed if: owner, counter member with incrementer/editor/admin role, or global counter:edit_any permission.
 */
export async function canIncrementCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  if (await isCounterOwner(userId, counterId)) return true;

  const memberRole = await getCounterMemberRole(userId, counterId);
  if (memberRole && counterIncrementRoles.includes(memberRole)) return true;

  return hasPermission(userId, "counter:edit_any");
}

/**
 * Check if a user can edit a counter.
 * Allowed if: owner, counter member with editor/admin role, or global counter:edit_any permission.
 */
export async function canEditCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  if (await isCounterOwner(userId, counterId)) return true;

  const memberRole = await getCounterMemberRole(userId, counterId);
  if (memberRole && counterEditRoles.includes(memberRole)) return true;

  return hasPermission(userId, "counter:edit_any");
}

/**
 * Check if a user can delete a counter.
 * Allowed if: owner, counter member with admin role, or global counter:delete_any permission.
 */
export async function canDeleteCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  if (await isCounterOwner(userId, counterId)) return true;

  const memberRole = await getCounterMemberRole(userId, counterId);
  if (memberRole === "admin") return true;

  return hasPermission(userId, "counter:delete_any");
}

/**
 * Check if a user can manage members of a counter.
 * Allowed if: owner, counter member with admin role, or global counter:edit_any permission.
 */
export async function canManageMembers(
  userId: string,
  counterId: string,
): Promise<boolean> {
  if (await isCounterOwner(userId, counterId)) return true;

  const memberRole = await getCounterMemberRole(userId, counterId);
  if (memberRole === "admin") return true;

  return hasPermission(userId, "counter:edit_any");
}

/**
 * Check if a user can view a private counter.
 * Allowed if: owner, any counter member, or global counter:edit_any permission.
 */
export async function canViewPrivateCounter(
  userId: string,
  counterId: string,
): Promise<boolean> {
  if (await isCounterOwner(userId, counterId)) return true;

  const memberRole = await getCounterMemberRole(userId, counterId);
  if (memberRole) return true;

  return hasPermission(userId, "counter:edit_any");
}
