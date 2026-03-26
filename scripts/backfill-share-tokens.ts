import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { counters } from "../src/lib/db/schema";
import crypto from "node:crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://user:password@localhost:5432/count_collab";

const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

function generateShareToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function backfill() {
  // Find all private counters without a share token
  const privateCounters = await db
    .select({ id: counters.id })
    .from(counters)
    .where(and(eq(counters.isPublic, 0), isNull(counters.shareToken)));

  console.log(
    `Found ${privateCounters.length} private counter(s) without a share token.`,
  );

  for (const counter of privateCounters) {
    const token = generateShareToken();
    await db
      .update(counters)
      .set({ shareToken: token })
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
      .where(eq(counters.id, counter.id as any));
    console.log(`  ✓ ${counter.id} → ${token}`);
  }

  console.log("Done.");
  await sql.end();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
