import { eq } from "drizzle-orm";
import { db } from "$lib/db";
import { permissions, rolePermissions, roles, users } from "$lib/db/schema";

/**
 * Get all permission names for a user based on their role.
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const rows = await db
    .select({ permission: permissions.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(users.id, userId));

  return rows.map((r) => r.permission);
}

/**
 * Check if a user has a specific permission.
 */
export async function hasPermission(
  userId: string,
  permission: string,
): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.includes(permission);
}

/**
 * Get the role name for a user.
 */
export async function getUserRole(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId));

  return row?.roleName ?? null;
}
