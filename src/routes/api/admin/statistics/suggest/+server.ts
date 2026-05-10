import { error, json } from "@sveltejs/kit";
import { and, eq, gte, ilike, sql } from "drizzle-orm";
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

const VALID_ENTITY_TYPES = [
  "counter",
  "dashboard",
  "follower",
  "goal",
  "invitation",
  "member",
  "user",
];

const STANDARD_FIELDS = ["eventType", "userId", "entityId", "entityType"];

const FIELD_NAME_RE = /^[a-zA-Z0-9_]+$/;

function escapeIlike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

export const GET: RequestHandler = async ({ url, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) throw error(401, "Sign in required");

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) throw error(403, "Admin access required");

  const type = url.searchParams.get("type");
  if (type !== "fields" && type !== "values") {
    throw error(
      400,
      "Missing or invalid parameter: type. Must be 'fields' or 'values'",
    );
  }

  const timeframe = url.searchParams.get("timeframe") ?? "30d";
  if (!TIMEFRAME_MAP[timeframe]) {
    throw error(400, "Invalid timeframe. Must be one of: 24h, 7d, 30d, 90d");
  }

  const since = new Date(Date.now() - TIMEFRAME_MAP[timeframe]);

  if (type === "fields") {
    return handleFields(since);
  }

  return handleValues(url, since);
};

async function handleFields(since: Date) {
  const standardFields = STANDARD_FIELDS.map((name) => ({
    name,
    type: "standard" as const,
  }));

  let metaFields: { name: string; type: "metadata" }[] = [];
  try {
    const metaRows = await db.execute<{ key: string }>(
      sql`SELECT DISTINCT key FROM (SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(metadata) = 'object' THEN metadata ELSE (metadata #>> '{}')::jsonb END) AS key FROM platform_events WHERE created_at >= ${since} AND metadata IS NOT NULL AND metadata != 'null'::jsonb) sub ORDER BY key`,
    );
    metaFields = metaRows.map((r) => ({
      name: r.key,
      type: "metadata" as const,
    }));
  } catch (e) {
    console.error("handleFields metadata query error:", e);
  }

  return json({ fields: [...standardFields, ...metaFields] });
}

async function handleValues(url: URL, since: Date) {
  const field = url.searchParams.get("field");
  if (!field) {
    throw error(400, "Missing required parameter: field");
  }

  if (!FIELD_NAME_RE.test(field)) {
    throw error(
      400,
      "Invalid field name. Only alphanumeric characters and underscores are allowed",
    );
  }

  const query = url.searchParams.get("query") ?? "";
  const limit = Math.max(
    1,
    Math.min(50, Number(url.searchParams.get("limit") ?? "20")),
  );

  const isStandard = STANDARD_FIELDS.includes(field);

  if (field === "eventType") {
    return handleEventTypeValues(query, limit);
  }

  if (field === "entityType") {
    return handleEntityTypeValues(query, limit);
  }

  if (field === "userId") {
    return handleUserIdValues(query, limit, since);
  }

  if (field === "counter_title") {
    return handleCounterTitleValues(query, limit);
  }

  if (field === "entityId") {
    return handleEntityIdValues(query, limit, since);
  }

  if (isStandard) {
    return json({ values: [] });
  }

  return handleMetadataValues(field, query, limit, since);
}

function handleEventTypeValues(query: string, limit: number) {
  let filtered = VALID_EVENT_TYPES;
  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter((t) => t.toLowerCase().startsWith(lowerQuery));
  }
  const values = filtered.slice(0, limit).map((v) => ({ value: v, label: v }));
  return json({ values });
}

function handleEntityTypeValues(query: string, limit: number) {
  let filtered = VALID_ENTITY_TYPES;
  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter((t) => t.toLowerCase().startsWith(lowerQuery));
  }
  const values = filtered.slice(0, limit).map((v) => ({ value: v, label: v }));
  return json({ values });
}

async function handleUserIdValues(query: string, limit: number, since: Date) {
  const conditions = [
    gte(platformEvents.createdAt, since),
    sql`${platformEvents.userId} IS NOT NULL`,
  ];

  if (query) {
    const escaped = escapeIlike(query);
    conditions.push(
      sql`(${users.name} ILIKE ${`${escaped}%`} OR ${users.username} ILIKE ${`${escaped}%`} OR ${platformEvents.userId} ILIKE ${`${escaped}%`})`,
    );
  }

  const rows = await db
    .select({
      value: platformEvents.userId,
      name: users.name,
      username: users.username,
    })
    .from(platformEvents)
    .leftJoin(users, eq(platformEvents.userId, users.id))
    .where(and(...conditions))
    .groupBy(platformEvents.userId, users.name, users.username)
    .orderBy(platformEvents.userId)
    .limit(limit);

  const values = rows.map((r) => {
    const label =
      r.name && r.username
        ? `${r.name} (@${r.username})`
        : r.username
          ? `@${r.username}`
          : (r.value ?? "");
    return { value: r.value ?? "", label };
  });

  return json({ values });
}

async function handleEntityIdValues(query: string, limit: number, since: Date) {
  const conditions = [
    gte(platformEvents.createdAt, since),
    sql`${platformEvents.entityId} IS NOT NULL`,
  ];

  if (query) {
    const escaped = escapeIlike(query);
    conditions.push(sql`${platformEvents.entityId} ILIKE ${`${escaped}%`}`);
  }

  const rows = await db
    .select({ value: platformEvents.entityId })
    .from(platformEvents)
    .where(and(...conditions))
    .groupBy(platformEvents.entityId)
    .orderBy(platformEvents.entityId)
    .limit(limit);

  const values = rows.map((r) => ({
    value: r.value ?? "",
    label: r.value ?? "",
  }));
  return json({ values });
}

async function handleMetadataValues(
  field: string,
  query: string,
  limit: number,
  since: Date,
) {
  const sanitizedField = field.replace(/'/g, "''");
  const metaExpr = sql`(CASE WHEN jsonb_typeof(${platformEvents.metadata}) = 'object' THEN ${platformEvents.metadata} ELSE (${platformEvents.metadata} #>> '{}')::jsonb END)->>${sql.raw(`'${sanitizedField}'`)}`;
  const conditions = [
    gte(platformEvents.createdAt, since),
    sql`${metaExpr} IS NOT NULL`,
  ];

  if (query) {
    const escaped = escapeIlike(query);
    conditions.push(sql`${metaExpr} ILIKE ${`${escaped}%`}`);
  }

  const rows = await db
    .select({ value: metaExpr.as("value") })
    .from(platformEvents)
    .where(and(...conditions))
    .groupBy(metaExpr)
    .orderBy(metaExpr)
    .limit(limit);

  const values = rows.map((r) => {
    const v = r.value as string;
    return { value: v, label: v };
  });

  return json({ values });
}

async function handleCounterTitleValues(query: string, limit: number) {
  const conditions = [];
  if (query) {
    const escaped = escapeIlike(query);
    conditions.push(ilike(counters.title, `${escaped}%`));
  }

  const rows = await db
    .select({ id: counters.id, title: counters.title })
    .from(counters)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(counters.title)
    .limit(limit);

  const values = rows.map((r) => ({
    value: r.id,
    label: r.title,
    filterField: "counter_id",
  }));

  return json({ values });
}
