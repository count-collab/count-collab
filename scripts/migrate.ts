import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://user:password@localhost:5432/count_collab";
const migrationClient = postgres(databaseUrl, { max: 1 });
const db = drizzle(migrationClient);

console.log("Running migrations...");
await migrate(db, { migrationsFolder: "./src/lib/db/migrations" });
console.log("Migrations complete!");
await migrationClient.end();
