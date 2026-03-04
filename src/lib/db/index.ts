import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logger } from "$lib/server/logger";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://user:password@localhost:5432/count_collab";

const queryClient = postgres(databaseUrl);

export const db = drizzle(queryClient, { schema });

export type DB = typeof db;

export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch (err) {
    logger.error("Database connection verification failed", {
      error: err instanceof Error ? err.message : String(err),
      databaseUrl: databaseUrl.replace(/:[^@]*@/, ":***@"),
    });
    return false;
  }
}
