import { and, count as countFn, eq } from "drizzle-orm";
import { db } from "$lib/db";
import {
  type CounterMember,
  type CounterMemberRole,
  counterMembers,
  users,
} from "$lib/db/schema";
import { logEvent } from "$lib/server/events";
import { logger } from "$lib/server/logger";

type MemberWithUser = CounterMember & {
  username: string | null;
  name: string | null;
  image: string | null;
};

/**
 * Invite a user to a counter by username.
 */
export async function inviteUserByUsername(
  counterId: string,
  username: string,
  role: CounterMemberRole,
): Promise<CounterMember | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));

  if (!user) return null;

  const [member] = await db
    .insert(counterMembers)
    .values({
      counterId,
      userId: user.id,
      role,
    })
    .onConflictDoUpdate({
      target: [counterMembers.counterId, counterMembers.userId],
      set: { role },
    })
    .returning();

  logger.info("User invited to counter", {
    counterId,
    username,
    role,
    userId: user.id,
  });

  return member;
}

/**
 * Remove a member from a counter.
 */
export async function removeMember(
  counterId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .delete(counterMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterMembers.counterId, counterId as any),
        eq(counterMembers.userId, userId),
      ),
    )
    .returning();

  if (result.length > 0) {
    logEvent({
      eventType: "member_removed",
      userId,
      entityId: counterId,
      entityType: "member",
      metadata: { target_type: "counter" },
    });
  }

  return result.length > 0;
}

/**
 * Update a member's role on a counter.
 */
export async function updateMemberRole(
  counterId: string,
  userId: string,
  role: CounterMemberRole,
): Promise<CounterMember | null> {
  const [updated] = await db
    .update(counterMembers)
    .set({ role })
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterMembers.counterId, counterId as any),
        eq(counterMembers.userId, userId),
      ),
    )
    .returning();

  return updated ?? null;
}

/**
 * Get all members of a counter with user details.
 */
export async function getCounterMembers(
  counterId: string,
): Promise<MemberWithUser[]> {
  const rows = await db
    .select({
      id: counterMembers.id,
      counterId: counterMembers.counterId,
      userId: counterMembers.userId,
      role: counterMembers.role,
      invitedAt: counterMembers.invitedAt,
      username: users.username,
      name: users.name,
      image: users.image,
    })
    .from(counterMembers)
    .innerJoin(users, eq(counterMembers.userId, users.id))
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counterMembers.counterId, counterId as any));

  return rows;
}

/**
 * Get the role a user has on a specific counter.
 */
export async function getUserCounterRole(
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
 * Count how many counters a user is a member of (excluding ownership).
 */
export async function getMembershipCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: countFn() })
    .from(counterMembers)
    .where(eq(counterMembers.userId, userId));
  return Number(row?.count ?? 0);
}
