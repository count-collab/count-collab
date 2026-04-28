import { and, isNull, lt, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { counters } from "../src/lib/db/schema";

const AUTO_DELETE_DAYS = 30;

async function cleanupInactiveCounters() {
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
    const deleted = await db
      .delete(counters)
      .where(
        and(
          isNull(counters.ownerId),
          ne(counters.visibilityMode, "private"),
          lt(
            counters.lastActivityAt,
            sql`NOW() - INTERVAL '${sql.raw(String(AUTO_DELETE_DAYS))} days'`,
          ),
        ),
      )
      .returning({ id: counters.id, title: counters.title });

    console.info(
      `Deleted ${deleted.length} inactive anonymous counter(s) older than ${AUTO_DELETE_DAYS} days.`,
    );

    for (const counter of deleted) {
      console.info(`  - ${counter.id} "${counter.title}"`);
    }
  } catch (error) {
    console.error("Failed to cleanup inactive counters:", error);
    process.exitCode = 1;
  } finally {
    await queryClient.end({ timeout: 5 });
  }
}

void cleanupInactiveCounters();
