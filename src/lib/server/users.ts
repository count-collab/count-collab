import { count as countFn, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "$lib/db";
import { accounts, counters, dashboards, roles, users } from "$lib/db/schema";

function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

type UserWithRole = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  username: string | null;
  roleName: string | null;
  roleId: number | null;
};

/**
 * List all users with their role names.
 */
export async function listUsers(
  limit = 50,
  query?: string,
  offset = 0,
): Promise<{ items: UserWithRole[]; total: number }> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? or(
      ilike(users.username, `%${escapeLikePattern(searchQuery)}%`),
      ilike(users.name, `%${escapeLikePattern(searchQuery)}%`),
      ilike(users.email, `%${escapeLikePattern(searchQuery)}%`),
    )
    : undefined;

  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        username: users.username,
        roleName: roles.name,
        roleId: users.roleId,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(whereClause)
      .orderBy(desc(users.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(users).where(whereClause),
  ]);

  return { items, total: Number(total) };
}

/**
 * Update a user's role.
 */
export async function updateUserRole(
  userId: string,
  roleId: number,
): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ roleId })
    .where(eq(users.id, userId))
    .returning();

  return result.length > 0;
}

/**
 * Delete a user and cascade their data.
 */
export async function deleteUser(userId: string): Promise<boolean> {
  // Delete all counters owned by this user (cascades to counter_history and counter_members)
  await db.delete(counters).where(eq(counters.ownerId, userId));

  const result = await db.delete(users).where(eq(users.id, userId)).returning();

  return result.length > 0;
}

/**
 * Get user by username.
 */
export async function getUserByUsername(username: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  return user ?? null;
}

/**
 * Check if a username is available.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username.toLowerCase()));
  return !existing;
}

/**
 * Set username for a user.
 */
export async function setUsername(
  userId: string,
  username: string,
): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ username: username.toLowerCase() })
    .where(eq(users.id, userId))
    .returning();
  return result.length > 0;
}

/**
 * Get basic user count and counter count for admin dashboard.
 */
export async function getAdminStats(): Promise<{
  userCount: number;
  counterCount: number;
  dashboardCount: number;
}> {
  const [userRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const [counterRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(counters);
  const [dashboardRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dashboards);

  return {
    userCount: userRow?.count ?? 0,
    counterCount: counterRow?.count ?? 0,
    dashboardCount: dashboardRow?.count ?? 0,
  };
}

/**
 * Get the OAuth providers connected to a user's account.
 */
export async function getConnectedProviders(userId: string): Promise<string[]> {
  const rows = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  return rows.map((r) => r.provider);
}
