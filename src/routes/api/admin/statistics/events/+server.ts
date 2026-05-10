import { error, json } from "@sveltejs/kit";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
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

const PAGE_SIZE = 50;

export const GET: RequestHandler = async ({ url, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) throw error(401, "Sign in required");

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) throw error(403, "Admin access required");

  const timeframe = url.searchParams.get("timeframe") ?? "30d";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  if (!TIMEFRAME_MAP[timeframe]) {
    throw error(400, "Invalid timeframe. Must be one of: 24h, 7d, 30d, 90d");
  }

  const since = new Date(Date.now() - TIMEFRAME_MAP[timeframe]);

  // Build filter conditions from query params prefixed with "filter."
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
    const field = key.slice("filter.".length);

    if (field === "eventType") continue; // already handled
    if (field === "userId") {
      conditions.push(eq(platformEvents.userId, value));
    } else if (field === "entityId") {
      conditions.push(eq(platformEvents.entityId, value));
    } else if (field === "entityType") {
      conditions.push(eq(platformEvents.entityType, value));
    } else {
      // Filter on metadata JSONB fields
      conditions.push(
        sql`(CASE WHEN jsonb_typeof(${platformEvents.metadata}) = 'object' THEN ${platformEvents.metadata} ELSE (${platformEvents.metadata} #>> '{}')::jsonb END)->>${sql.raw(`'${field.replace(/'/g, "''")}'`)} = ${value}`,
      );
    }
  }

  const queryStart = performance.now();

  const offset = (page - 1) * PAGE_SIZE;

  // Get total count and events in parallel
  const [countResult, events] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(platformEvents)
      .where(and(...conditions)),
    db
      .select({
        id: platformEvents.id,
        eventType: platformEvents.eventType,
        userId: platformEvents.userId,
        entityId: platformEvents.entityId,
        entityType: platformEvents.entityType,
        metadata: platformEvents.metadata,
        createdAt: platformEvents.createdAt,
        userName: users.name,
        userUsername: users.username,
        userImage: users.image,
      })
      .from(platformEvents)
      .leftJoin(users, eq(platformEvents.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(platformEvents.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
  ]);

  const total = countResult[0]?.total ?? 0;

  // Enrich events with counter titles where missing
  const counterIds = new Set<string>();
  for (const e of events) {
    const meta = e.metadata as Record<string, unknown> | null;
    if (meta?.counter_id && !meta.counter_title) {
      counterIds.add(String(meta.counter_id));
    }
    // entityId is a counter UUID for counter-type and invitation-type entities
    if (
      (e.entityType === "counter" || e.entityType === "invitation") &&
      e.entityId
    ) {
      const meta2 = e.metadata as Record<string, unknown> | null;
      if (!meta2?.counter_title) counterIds.add(e.entityId);
    }
  }

  let counterTitleMap = new Map<string, string>();
  if (counterIds.size > 0) {
    const counterRows = await db
      .select({ id: counters.id, title: counters.title })
      .from(counters)
      .where(inArray(counters.id, [...counterIds]));
    counterTitleMap = new Map(counterRows.map((r) => [r.id, r.title]));
  }

  // Resolve invited_user_id to username
  const invitedUserIds = new Set<string>();
  for (const e of events) {
    const meta = e.metadata as Record<string, unknown> | null;
    if (meta?.invited_user_id && !meta.invited_user_name) {
      invitedUserIds.add(String(meta.invited_user_id));
    }
  }

  let userNameMap = new Map<string, string>();
  if (invitedUserIds.size > 0) {
    const userRows = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, [...invitedUserIds]));
    userNameMap = new Map(
      userRows
        .filter((r) => r.username)
        .map((r) => [r.id, r.username as string]),
    );
  }

  const queryDurationMs =
    Math.round((performance.now() - queryStart) * 100) / 100;

  return json({
    timeframe,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
    queryDurationMs,
    events: events.map((e) => {
      const meta = e.metadata as Record<string, unknown> | null;
      let enrichedMeta = meta;

      // Inject counter_title if we have one and it's missing
      if (meta && !meta.counter_title) {
        const cid =
          meta.counter_id != null
            ? String(meta.counter_id)
            : e.entityType === "counter" || e.entityType === "invitation"
              ? e.entityId
              : null;
        if (cid && counterTitleMap.has(cid)) {
          enrichedMeta = { counter_title: counterTitleMap.get(cid), ...meta };
        }
      }

      // Inject invited_user_name if we resolved one
      if (enrichedMeta?.invited_user_id && !enrichedMeta.invited_user_name) {
        const uid = String(enrichedMeta.invited_user_id);
        if (userNameMap.has(uid)) {
          enrichedMeta = {
            ...enrichedMeta,
            invited_user_name: userNameMap.get(uid),
          };
        }
      }

      return {
        id: e.id,
        eventType: e.eventType,
        userId: e.userId,
        entityId: e.entityId,
        entityType: e.entityType,
        metadata: enrichedMeta,
        createdAt: e.createdAt,
        user: e.userId
          ? {
              name: e.userName,
              username: e.userUsername,
              image: e.userImage,
            }
          : null,
      };
    }),
  });
};
