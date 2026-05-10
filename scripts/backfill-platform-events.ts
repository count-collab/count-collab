/**
 * Backfill platform_events from existing data.
 *
 * Reconstructs historical events from:
 * - counter_history → counter_action events
 * - counters.created_at → counter_created events
 * - dashboards.created_at → dashboard_created events
 * - users.created_at → user_registered events
 *
 * Run: bun scripts/backfill-platform-events.ts
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://user:password@localhost:5432/count_collab";
const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });

const BATCH_SIZE = 1000;

async function backfillCounterActions() {
  console.log("Backfilling counter_action events from counter_history...");

  const total = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.counterHistory);
  const totalCount = total[0]?.count ?? 0;
  console.log(`  Found ${totalCount} counter_history entries`);

  let offset = 0;
  let inserted = 0;

  while (offset < totalCount) {
    const rows = await db
      .select({
        counterId: schema.counterHistory.counterId,
        changedBy: schema.counterHistory.changedBy,
        changedAt: schema.counterHistory.changedAt,
        previousValue: schema.counterHistory.previousValue,
        newValue: schema.counterHistory.newValue,
      })
      .from(schema.counterHistory)
      .orderBy(schema.counterHistory.id)
      .limit(BATCH_SIZE)
      .offset(offset);

    if (rows.length === 0) break;

    const values = rows.map((row) => ({
      eventType: "counter_action" as const,
      userId: row.changedBy,
      entityId: row.counterId,
      entityType: "counter" as const,
      metadata: {
        direction: row.newValue > row.previousValue ? "increment" : "decrement",
        amount: Math.abs(row.newValue - row.previousValue),
      },
      createdAt: row.changedAt,
    }));

    await db.insert(schema.platformEvents).values(values);
    inserted += values.length;
    offset += BATCH_SIZE;
    process.stdout.write(`  Inserted ${inserted}/${totalCount}\r`);
  }

  console.log(`  ✓ Backfilled ${inserted} counter_action events`);
}

async function backfillCounterCreated() {
  console.log("Backfilling counter_created events from counters...");

  const rows = await db
    .select({
      id: schema.counters.id,
      title: schema.counters.title,
      ownerId: schema.counters.ownerId,
      createdAt: schema.counters.createdAt,
    })
    .from(schema.counters);

  if (rows.length === 0) {
    console.log("  No counters found");
    return;
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => ({
      eventType: "counter_created" as const,
      userId: row.ownerId,
      entityId: row.id,
      entityType: "counter" as const,
      metadata: { counter_title: row.title },
      createdAt: row.createdAt,
    }));

    await db.insert(schema.platformEvents).values(values);
  }

  console.log(`  ✓ Backfilled ${rows.length} counter_created events`);
}

async function backfillDashboardCreated() {
  console.log("Backfilling dashboard_created events from dashboards...");

  const rows = await db
    .select({
      id: schema.dashboards.id,
      title: schema.dashboards.title,
      ownerId: schema.dashboards.ownerId,
      createdAt: schema.dashboards.createdAt,
    })
    .from(schema.dashboards);

  if (rows.length === 0) {
    console.log("  No dashboards found");
    return;
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => ({
      eventType: "dashboard_created" as const,
      userId: row.ownerId,
      entityId: row.id,
      entityType: "dashboard" as const,
      metadata: { dashboard_title: row.title },
      createdAt: row.createdAt,
    }));

    await db.insert(schema.platformEvents).values(values);
  }

  console.log(`  ✓ Backfilled ${rows.length} dashboard_created events`);
}

async function backfillUserRegistered() {
  console.log("Backfilling user_registered events from users...");

  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);

  if (rows.length === 0) {
    console.log("  No users found");
    return;
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map((row) => ({
      eventType: "user_registered" as const,
      userId: row.id,
      entityId: row.id,
      entityType: "user" as const,
      metadata: { user_name: row.name, email: row.email },
      createdAt: row.createdAt,
    }));

    await db.insert(schema.platformEvents).values(values);
  }

  console.log(`  ✓ Backfilled ${rows.length} user_registered events`);
}

async function main() {
  console.log("Starting platform_events backfill...\n");

  // Check if there are already events (prevent duplicate runs)
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.platformEvents);

  if ((existing?.count ?? 0) > 0) {
    console.log(
      `⚠️  platform_events already has ${existing.count} rows. Skipping to prevent duplicates.`,
    );
    console.log(
      "   To re-run, truncate the table first: TRUNCATE platform_events RESTART IDENTITY;",
    );
    await client.end();
    process.exit(0);
  }

  await backfillCounterActions();
  await backfillCounterCreated();
  await backfillDashboardCreated();
  await backfillUserRegistered();

  const [final] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.platformEvents);

  console.log(`\n✅ Backfill complete. Total events: ${final.count}`);
  await client.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  client.end();
  process.exit(1);
});
