import { like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { counters, users } from "../src/lib/db/schema";

const SEED_EMAIL_DOMAIN = "seed.countcollab.local";

async function deleteAllCounters() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(
      "Error: DATABASE_URL environment variable is not set. Please configure it in your .env file.",
    );
    process.exitCode = 1;
    return;
  }

  const queryClient = postgres(databaseUrl);
  const db = drizzle(queryClient);

  try {
    const deleted = await db.delete(counters).returning({ id: counters.id });
    console.info(`Deleted ${deleted.length} counters (and their history).`);

    const deletedUsers = await db
      .delete(users)
      .where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`))
      .returning({ id: users.id });
    console.info(`Deleted ${deletedUsers.length} seed users.`);
  } catch (error) {
    console.error("Failed to delete counters:", error);
    process.exitCode = 1;
  } finally {
    await queryClient.end({ timeout: 5 });
  }
}

void deleteAllCounters();
