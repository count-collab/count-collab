import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { counters } from "../src/lib/db/schema";

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
  } catch (error) {
    console.error("Failed to delete counters:", error);
    process.exitCode = 1;
  } finally {
    await queryClient.end({ timeout: 5 });
  }
}

void deleteAllCounters();
