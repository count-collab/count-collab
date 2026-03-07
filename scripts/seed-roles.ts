/**
 * Seed roles and permissions into the database.
 * Run: bun run db:seed-roles
 */
import { db } from "../src/lib/db";
import { roles, permissions, rolePermissions } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const ROLES = [
  {
    name: "user",
    description: "Default user — can create and manage own counters",
  },
  {
    name: "admin",
    description: "Administrator — full access to all counters and users",
  },
] as const;

const PERMISSIONS = [
  { name: "counter:create", description: "Create new counters" },
  { name: "counter:edit_own", description: "Edit own counters" },
  { name: "counter:delete_own", description: "Delete own counters" },
  { name: "counter:edit_any", description: "Edit any counter" },
  { name: "counter:delete_any", description: "Delete any counter" },
  { name: "user:view", description: "View all users" },
  { name: "user:manage", description: "Manage users (roles, delete)" },
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  user: ["counter:create", "counter:edit_own", "counter:delete_own"],
  admin: [
    "counter:create",
    "counter:edit_own",
    "counter:delete_own",
    "counter:edit_any",
    "counter:delete_any",
    "user:view",
    "user:manage",
  ],
};

async function seed() {
  console.log("Seeding roles and permissions...");

  // Upsert roles
  for (const role of ROLES) {
    const existing = await db
      .select()
      .from(roles)
      .where(eq(roles.name, role.name));
    if (existing.length === 0) {
      await db.insert(roles).values(role);
      console.log(`  Created role: ${role.name}`);
    } else {
      console.log(`  Role already exists: ${role.name}`);
    }
  }

  // Upsert permissions
  for (const perm of PERMISSIONS) {
    const existing = await db
      .select()
      .from(permissions)
      .where(eq(permissions.name, perm.name));
    if (existing.length === 0) {
      await db.insert(permissions).values(perm);
      console.log(`  Created permission: ${perm.name}`);
    } else {
      console.log(`  Permission already exists: ${perm.name}`);
    }
  }

  // Map role → permissions
  const allRoles = await db.select().from(roles);
  const allPerms = await db.select().from(permissions);

  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = allRoles.find((r) => r.name === roleName);
    if (!role) continue;

    for (const permName of permNames) {
      const perm = allPerms.find((p) => p.name === permName);
      if (!perm) continue;

      const existing = await db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id));

      const alreadyMapped = existing.some((e) => e.permissionId === perm.id);
      if (!alreadyMapped) {
        await db.insert(rolePermissions).values({
          roleId: role.id,
          permissionId: perm.id,
        });
        console.log(`  Mapped ${roleName} → ${permName}`);
      }
    }
  }

  console.log("Done seeding roles and permissions.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
