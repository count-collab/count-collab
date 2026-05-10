import { error, json } from "@sveltejs/kit";
import { and, count as countFn, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "$lib/db";
import { platformEvents, users } from "$lib/db/schema";
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

const STANDARD_FIELDS = ["eventType", "userId", "entityId", "entityType"];

const FIELD_NAME_RE = /^[a-zA-Z0-9_]+$/;

const FIELD_COLUMN_MAP = {
  eventType: platformEvents.eventType,
  userId: platformEvents.userId,
  entityId: platformEvents.entityId,
  entityType: platformEvents.entityType,
} as const;

export const GET: RequestHandler = async ({ url, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) throw error(401, "Sign in required");

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) throw error(403, "Admin access required");

  const field = url.searchParams.get("field");
  const timeframe = url.searchParams.get("timeframe") ?? "30d";
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit") ?? "20")),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));

  if (!field) {
    throw error(400, "Missing required parameter: field");
  }

  if (!FIELD_NAME_RE.test(field)) {
    throw error(
      400,
      "Invalid field name. Only alphanumeric characters and underscores are allowed",
    );
  }

  if (!TIMEFRAME_MAP[timeframe]) {
    throw error(400, "Invalid timeframe. Must be one of: 24h, 7d, 30d, 90d");
  }

  const since = new Date(Date.now() - TIMEFRAME_MAP[timeframe]);

  // Build filter conditions
  const conditions = [gte(platformEvents.createdAt, since)];

  const filterEventType = url.searchParams.get("filter.eventType") || null;
  if (filterEventType) {
    if (!VALID_EVENT_TYPES.includes(filterEventType)) {
      throw error(
        400,
        `Invalid filter.eventType. Must be one of: ${VALID_EVENT_TYPES.join(", ")}`,
      );
    }
    conditions.push(eq(platformEvents.eventType, filterEventType));
  }

  for (const [key, value] of url.searchParams.entries()) {
    if (!key.startsWith("filter.") || !value) continue;
    const filterField = key.slice("filter.".length);

    if (filterField === "eventType") continue; // already handled
    if (filterField === "userId") {
      conditions.push(eq(platformEvents.userId, value));
    } else if (filterField === "entityId") {
      conditions.push(eq(platformEvents.entityId, value));
    } else if (filterField === "entityType") {
      conditions.push(eq(platformEvents.entityType, value));
    } else {
      conditions.push(
        sql`(CASE WHEN jsonb_typeof(${platformEvents.metadata}) = 'object' THEN ${platformEvents.metadata} ELSE (${platformEvents.metadata} #>> '{}')::jsonb END)->>${sql.raw(`'${filterField.replace(/'/g, "''")}'`)} = ${value}`,
      );
    }
  }

  const queryStart = performance.now();
  const isStandard = STANDARD_FIELDS.includes(field);

  let values: {
    value: string | null;
    count: number;
    label: string | null;
    extra: Record<string, unknown> | null;
  }[];
  let total: number;

  if (isStandard && field === "userId") {
    // userId aggregation with user join
    const column = FIELD_COLUMN_MAP[field];

    const [countResult, rows] = await Promise.all([
      db
        .select({ total: sql<number>`count(DISTINCT ${column})::int` })
        .from(platformEvents)
        .where(and(...conditions)),
      db
        .select({
          value: column,
          count: countFn().as("count"),
          name: users.name,
          username: users.username,
          image: users.image,
        })
        .from(platformEvents)
        .leftJoin(users, eq(platformEvents.userId, users.id))
        .where(and(...conditions))
        .groupBy(column, users.name, users.username, users.image)
        .orderBy(desc(countFn()))
        .limit(limit)
        .offset(offset),
    ]);

    total = countResult[0]?.total ?? 0;
    values = rows.map((r) => ({
      value: r.value,
      count: Number(r.count),
      label: r.name ?? r.username ?? r.value,
      extra: { username: r.username, image: r.image },
    }));
  } else if (isStandard) {
    // Standard field aggregation (eventType, entityId, entityType)
    const column = FIELD_COLUMN_MAP[field as keyof typeof FIELD_COLUMN_MAP];

    const [countResult, rows] = await Promise.all([
      db
        .select({ total: sql<number>`count(DISTINCT ${column})::int` })
        .from(platformEvents)
        .where(and(...conditions)),
      db
        .select({
          value: column,
          count: countFn().as("count"),
        })
        .from(platformEvents)
        .where(and(...conditions))
        .groupBy(column)
        .orderBy(desc(countFn()))
        .limit(limit)
        .offset(offset),
    ]);

    total = countResult[0]?.total ?? 0;
    values = rows.map((r) => ({
      value: r.value,
      count: Number(r.count),
      label: r.value,
      extra: null,
    }));
  } else {
    // Metadata sub-field aggregation
    const metaExpr = sql`(CASE WHEN jsonb_typeof(${platformEvents.metadata}) = 'object' THEN ${platformEvents.metadata} ELSE (${platformEvents.metadata} #>> '{}')::jsonb END)->>${sql.raw(`'${field.replace(/'/g, "''")}'`)}`;
    const metaConditions = [...conditions, sql`${metaExpr} IS NOT NULL`];

    const [countResult, rows] = await Promise.all([
      db
        .select({ total: sql<number>`count(DISTINCT ${metaExpr})::int` })
        .from(platformEvents)
        .where(and(...metaConditions)),
      db
        .select({
          value: metaExpr.as("value"),
          count: countFn().as("count"),
        })
        .from(platformEvents)
        .where(and(...metaConditions))
        .groupBy(metaExpr)
        .orderBy(desc(countFn()))
        .limit(limit)
        .offset(offset),
    ]);

    total = countResult[0]?.total ?? 0;
    values = rows.map((r) => ({
      value: r.value as string,
      count: Number(r.count),
      label: r.value as string,
      extra: null,
    }));
  }

  const queryDurationMs =
    Math.round((performance.now() - queryStart) * 100) / 100;

  return json({
    field,
    timeframe,
    queryDurationMs,
    total,
    values,
  });
};
