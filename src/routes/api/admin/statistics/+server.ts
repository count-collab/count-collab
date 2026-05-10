import { error, json } from "@sveltejs/kit";
import { and, count as countFn, eq, gte, sql } from "drizzle-orm";
import { db } from "$lib/db";
import { platformEvents } from "$lib/db/schema";
import { hasPermission } from "$lib/server/permissions";
import type { RequestHandler } from "./$types";

const TIMEFRAME_MAP: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

const VALID_EVENT_TYPES = [
  "counter_action",
  "counter_created",
  "counter_deleted",
  "dashboard_created",
  "dashboard_deleted",
  "user_registered",
  "user_deleted",
  "goal_created",
  "goal_deleted",
  "goal_reached",
  "invitation_sent",
  "invitation_accepted",
  "invitation_deleted",
  "follower_added",
  "follower_removed",
  "member_removed",
];

export const GET: RequestHandler = async ({ url, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) throw error(401, "Sign in required");

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) throw error(403, "Admin access required");

  const timeframe = url.searchParams.get("timeframe") ?? "30d";

  if (!TIMEFRAME_MAP[timeframe]) {
    throw error(400, "Invalid timeframe. Must be one of: 24h, 7d, 30d, 90d");
  }

  // Parse filter.* params
  const filterEventType = url.searchParams.get("filter.eventType") || null;
  if (filterEventType && !VALID_EVENT_TYPES.includes(filterEventType)) {
    throw error(
      400,
      `Invalid filter.eventType. Must be one of: ${VALID_EVENT_TYPES.join(", ")}`,
    );
  }

  const since = new Date(Date.now() - TIMEFRAME_MAP[timeframe]);

  const granularity =
    timeframe === "24h" ? "hourly" : timeframe === "7d" ? "6h" : "daily";

  const bucketExpr =
    granularity === "hourly"
      ? sql`date_trunc('hour', ${platformEvents.createdAt})`
      : granularity === "6h"
        ? sql`to_timestamp(floor(extract(epoch from ${platformEvents.createdAt}) / 21600) * 21600)`
        : sql`date_trunc('day', ${platformEvents.createdAt})`;

  // Build conditions
  const conditions = [gte(platformEvents.createdAt, since)];

  if (filterEventType) {
    conditions.push(eq(platformEvents.eventType, filterEventType));
  }

  for (const [key, value] of url.searchParams.entries()) {
    if (!key.startsWith("filter.") || !value) continue;
    const field = key.slice("filter.".length);

    if (field === "eventType") continue; // already handled
    if (field === "userId") {
      conditions.push(eq(platformEvents.userId, value));
    } else if (field === "entityId") {
      conditions.push(eq(platformEvents.entityId, value));
    } else if (field === "entityType") {
      conditions.push(eq(platformEvents.entityType, value));
    } else {
      conditions.push(
        sql`(CASE WHEN jsonb_typeof(${platformEvents.metadata}) = 'object' THEN ${platformEvents.metadata} ELSE (${platformEvents.metadata} #>> '{}')::jsonb END)->>${sql.raw(`'${field.replace(/'/g, "''")}'`)} = ${value}`,
      );
    }
  }

  const queryStart = performance.now();

  // Query grouped by bucket AND event type
  const rows = await db
    .select({
      bucket: bucketExpr.as("bucket"),
      eventType: platformEvents.eventType,
      count: countFn().as("count"),
    })
    .from(platformEvents)
    .where(and(...conditions))
    .groupBy(bucketExpr, platformEvents.eventType)
    .orderBy(bucketExpr);

  // Restructure into Record<string, {timestamp, count}[]>
  const timeSeries: Record<string, { timestamp: string; count: number }[]> = {};
  for (const row of rows) {
    const key = row.eventType;
    if (!timeSeries[key]) {
      timeSeries[key] = [];
    }
    timeSeries[key].push({
      timestamp: row.bucket as string,
      count: Number(row.count),
    });
  }

  const queryDurationMs =
    Math.round((performance.now() - queryStart) * 100) / 100;

  return json({
    timeframe,
    granularity,
    since: since.toISOString(),
    queryDurationMs,
    timeSeries,
  });
};
