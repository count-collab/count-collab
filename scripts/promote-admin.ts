/**
 * Promote a user to admin by email.
 * Run: bun run scripts/promote-admin.ts --email user@example.com
 */
import { db } from "../src/lib/db";
import { users, roles } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const args = process.argv.slice(2);
const emailIdx = args.indexOf("--email");

if (emailIdx === -1 || !args[emailIdx + 1]) {
  console.error(
    "Usage: bun run scripts/promote-admin.ts --email user@example.com",
  );
  process.exit(1);
}

const email = args[emailIdx + 1];

async function promote() {
  const [adminRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, "admin"));

  if (!adminRole) {
    console.error("Admin role not found. Run 'bun run db:seed-roles' first.");
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    console.error(`User with email "${email}" not found.`);
    process.exit(1);
  }

  await db
    .update(users)
    .set({ roleId: adminRole.id })
    .where(eq(users.id, user.id));

  console.log(`Promoted ${user.username ?? user.email} to admin.`);
  process.exit(0);
}

promote().catch((err) => {
  console.error("Promote failed:", err);
  process.exit(1);
});
