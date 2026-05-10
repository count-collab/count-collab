import { error, json } from "@sveltejs/kit";
import { and, count as countFn, eq, gte, sql } from "drizzle-orm";
import { db } from "$lib/db";
import { counters, platformEvents, users } from "$lib/db/schema";
import { hasPermission } from "$lib/server/permissions";
import type { RequestHandler } from "./$types";

const TIMEFRAME_MAP: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

const VALID_METRICS = [
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

  const metric = url.searchParams.get("metric");
  const timeframe = url.searchParams.get("timeframe") ?? "30d";
  const userId = url.searchParams.get("userId") || null;
  const counterId = url.searchParams.get("counterId") || null;

  if (!metric || !VALID_METRICS.includes(metric)) {
    throw error(
      400,
      `Invalid metric. Must be one of: ${VALID_METRICS.join(", ")}`,
    );
  }

  if (!TIMEFRAME_MAP[timeframe]) {
    throw error(400, "Invalid timeframe. Must be one of: 24h, 7d, 30d, 90d");
  }

  const since = new Date(Date.now() - TIMEFRAME_MAP[timeframe]);
  const useHourly = timeframe === "24h" || timeframe === "7d";

  // Build the time bucket expression
  const bucketExpr = useHourly
    ? sql`date_trunc('hour', ${platformEvents.createdAt})`
    : sql`date_trunc('day', ${platformEvents.createdAt})`;

  // Build conditions
  const conditions = [
    eq(platformEvents.eventType, metric),
    gte(platformEvents.createdAt, since),
  ];

  if (userId) {
    conditions.push(eq(platformEvents.userId, userId));
  }

  if (counterId) {
    conditions.push(eq(platformEvents.entityId, counterId));
  }

  const queryStart = performance.now();

  // Get time-series data
  const timeSeries = await db
    .select({
      bucket: bucketExpr.as("bucket"),
      count: countFn().as("count"),
    })
    .from(platformEvents)
    .where(and(...conditions))
    .groupBy(bucketExpr)
    .orderBy(bucketExpr);

  // Get top users for this metric/timeframe (filtered by counterId if set)
  const topUsers = await db
    .select({
      userId: platformEvents.userId,
      count: countFn().as("count"),
      userName: users.name,
      userUsername: users.username,
      userImage: users.image,
    })
    .from(platformEvents)
    .leftJoin(users, eq(platformEvents.userId, users.id))
    .where(
      and(
        eq(platformEvents.eventType, metric),
        gte(platformEvents.createdAt, since),
        ...(counterId ? [eq(platformEvents.entityId, counterId)] : []),
      ),
    )
    .groupBy(platformEvents.userId, users.name, users.username, users.image)
    .orderBy(sql`count(*) DESC`)
    .limit(50);

  // Get top counters (only for counter_action metric)
  let topCounters: { counterId: string; title: string; count: number }[] = [];
  if (metric === "counter_action") {
    const counterRows = await db
      .select({
        entityId: platformEvents.entityId,
        count: countFn().as("count"),
        counterTitle: counters.title,
      })
      .from(platformEvents)
      .leftJoin(
        counters,
        sql`${platformEvents.entityId} IS NOT NULL AND ${counters.id} = ${platformEvents.entityId}::uuid`,
      )
      .where(
        and(
          eq(platformEvents.eventType, metric),
          eq(platformEvents.entityType, "counter"),
          gte(platformEvents.createdAt, since),
          ...(userId ? [eq(platformEvents.userId, userId)] : []),
        ),
      )
      .groupBy(platformEvents.entityId, counters.title)
      .orderBy(sql`count(*) DESC`)
      .limit(50);

    topCounters = counterRows
      .filter((r) => r.entityId !== null)
      .map((r) => ({
        counterId: r.entityId as string,
        title: r.counterTitle ?? "Deleted counter",
        count: Number(r.count),
      }));
  }

  const queryDurationMs =
    Math.round((performance.now() - queryStart) * 100) / 100;

  return json({
    metric,
    timeframe,
    granularity: useHourly ? "hourly" : "daily",
    since: since.toISOString(),
    queryDurationMs,
    timeSeries: timeSeries.map((row) => ({
      timestamp: row.bucket,
      count: Number(row.count),
    })),
    topUsers: topUsers
      .filter((u) => u.userId !== null)
      .map((u) => ({
        userId: u.userId,
        name: u.userName,
        username: u.userUsername,
        image: u.userImage,
        count: Number(u.count),
      })),
    topCounters,
  });
};
