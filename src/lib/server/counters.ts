import {
  type AnyColumn,
  and,
  asc,
  count as countFn,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "$lib/db";
import type {
  Counter,
  CounterMode,
  CounterVisibilityMode,
  NewCounter,
  NewCounterHistory,
  SparklinePoint,
} from "$lib/db/schema";
import {
  counterHistory as counterHistoryTable,
  counterMembers,
  counters as countersTable,
  users,
} from "$lib/db/schema";
import { createCache } from "$lib/server/cache";
import { escapeLikePattern, generateShareToken } from "$lib/server/crypto";
import { logger } from "$lib/server/logger";

export const sparklineCache = createCache<SparklinePoint[]>({
  ttlMs: 300_000,
  maxSize: 500,
});

const publicCounterVisibilityModes: CounterVisibilityMode[] = [
  "public",
  "public_readonly",
];

function deriveLegacyIsPublic(visibilityMode: CounterVisibilityMode): 0 | 1 {
  return visibilityMode === "private" ? 0 : 1;
}

function resolveCounterVisibility(input: {
  visibilityMode?: CounterVisibilityMode;
  isPublic?: boolean;
}): CounterVisibilityMode {
  if (input.visibilityMode !== undefined) {
    return input.visibilityMode;
  }

  return input.isPublic === false ? "private" : "public";
}

type CreateCounterInput = {
  title: string;
  description?: string | null;
  isPublic?: boolean;
  visibilityMode?: CounterVisibilityMode;
  counterMode?: CounterMode;
  ownerId?: string | null;
};

export async function createCounter(
  input: CreateCounterInput,
): Promise<Counter> {
  const visibilityMode = resolveCounterVisibility(input);

  const newCounter: NewCounter = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    count: 0,
    isPublic: deriveLegacyIsPublic(visibilityMode),
    visibilityMode,
    counterMode: input.counterMode ?? "increment_only",
    shareToken: visibilityMode === "private" ? generateShareToken() : null,
    ownerId: input.ownerId ?? null,
  };

  const [counter] = await db
    .insert(countersTable)
    .values(newCounter)
    .returning();

  logger.info("Counter created", {
    id: counter.id,
    title: counter.title,
    isPublic: counter.isPublic,
    visibilityMode: counter.visibilityMode,
  });

  return counter;
}

export async function listPublicCounters(
  limit = 12,
  query?: string,
  offset = 0,
): Promise<{ items: Counter[]; total: number }> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? and(
        inArray(countersTable.visibilityMode, publicCounterVisibilityModes),
        or(
          ilike(countersTable.title, `%${escapeLikePattern(searchQuery)}%`),
          ilike(
            countersTable.description,
            `%${escapeLikePattern(searchQuery)}%`,
          ),
        ),
      )
    : inArray(countersTable.visibilityMode, publicCounterVisibilityModes);

  const actionCountSq = db
    .select({
      counterId: counterHistoryTable.counterId,
      actionCount: countFn().as("action_count"),
    })
    .from(counterHistoryTable)
    .groupBy(counterHistoryTable.counterId)
    .as("action_counts");

  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: countersTable.id,
        title: countersTable.title,
        description: countersTable.description,
        count: countersTable.count,
        isPublic: countersTable.isPublic,
        visibilityMode: countersTable.visibilityMode,
        counterMode: countersTable.counterMode,
        shareToken: countersTable.shareToken,
        cooldownEnabled: countersTable.cooldownEnabled,
        cooldownSeconds: countersTable.cooldownSeconds,
        goalsEnabled: countersTable.goalsEnabled,
        scoreboardEnabled: countersTable.scoreboardEnabled,
        ownerId: countersTable.ownerId,
        createdAt: countersTable.createdAt,
        updatedAt: countersTable.updatedAt,
        lastActivityAt: countersTable.lastActivityAt,
      })
      .from(countersTable)
      .leftJoin(actionCountSq, eq(countersTable.id, actionCountSq.counterId))
      .where(whereClause)
      .orderBy(
        desc(sql`COALESCE(${actionCountSq.actionCount}, 0)`),
        desc(countersTable.updatedAt),
      )
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(countersTable).where(whereClause),
  ]);

  return { items, total: Number(total) };
}

export async function listRecentlyCreatedCounters(
  limit = 6,
): Promise<Counter[]> {
  return db
    .select()
    .from(countersTable)
    .where(inArray(countersTable.visibilityMode, publicCounterVisibilityModes))
    .orderBy(desc(countersTable.createdAt))
    .limit(limit);
}

export async function listRecentlyUpdatedCounters(
  limit = 6,
): Promise<Counter[]> {
  return db
    .select()
    .from(countersTable)
    .where(inArray(countersTable.visibilityMode, publicCounterVisibilityModes))
    .orderBy(desc(countersTable.updatedAt))
    .limit(limit);
}

export async function listPublicCounterSitemapEntries(): Promise<
  { id: string; title: string; updatedAt: Date | null }[]
> {
  return db
    .select({
      id: countersTable.id,
      title: countersTable.title,
      updatedAt: countersTable.updatedAt,
    })
    .from(countersTable)
    .where(inArray(countersTable.visibilityMode, publicCounterVisibilityModes));
}

export async function getCounter(counterId: string): Promise<Counter | null> {
  const [counter] = await db
    .select()
    .from(countersTable)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
    .where(eq(countersTable.id, counterId as any));
  return counter ?? null;
}

export async function incrementCounter(
  counterId: string,
  delta = 1,
  userId?: string,
): Promise<Counter | null> {
  // Use transaction to ensure atomic increment
  return await db.transaction(async (tx) => {
    // Lock the row for update to prevent race conditions
    const [counter] = await tx
      .select()
      .from(countersTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
      .where(eq(countersTable.id, counterId as any))
      .for("update");

    if (!counter) return null;

    const nextValue = counter.count + delta;

    // Record history entry
    const historyEntry: NewCounterHistory = {
      counterId: counter.id,
      previousValue: counter.count,
      newValue: nextValue,
      changedBy: userId ?? null,
    };

    await tx.insert(counterHistoryTable).values(historyEntry);

    // Update counter
    const [updated] = await tx
      .update(countersTable)
      .set({
        count: nextValue,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(countersTable.id, counter.id))
      .returning();

    logger.debug("Counter incremented", {
      id: counterId,
      from: counter.count,
      to: nextValue,
    });

    sparklineCache.delete(counterId);

    return updated;
  });
}

export type CounterHistoryWithUser = {
  id: number;
  counterId: string;
  previousValue: number;
  newValue: number;
  changedBy: string | null;
  changedAt: Date;
  username: string | null;
};

export async function getCounterHistory(
  counterId: string,
  limit = 20,
): Promise<CounterHistoryWithUser[]> {
  const rows = await db
    .select({
      id: counterHistoryTable.id,
      counterId: counterHistoryTable.counterId,
      previousValue: counterHistoryTable.previousValue,
      newValue: counterHistoryTable.newValue,
      changedBy: counterHistoryTable.changedBy,
      changedAt: counterHistoryTable.changedAt,
      username: users.username,
    })
    .from(counterHistoryTable)
    .leftJoin(users, eq(counterHistoryTable.changedBy, users.id))
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
    .where(eq(counterHistoryTable.counterId, counterId as any))
    .orderBy(desc(counterHistoryTable.changedAt))
    .limit(limit);
  return rows;
}

type UpdateCounterInput = {
  title?: string;
  description?: string | null;
  isPublic?: boolean;
  visibilityMode?: CounterVisibilityMode;
  counterMode?: CounterMode;
  cooldownEnabled?: boolean;
  cooldownSeconds?: number;
  goalsEnabled?: boolean;
  scoreboardEnabled?: boolean;
};

export async function updateCounter(
  counterId: string,
  input: UpdateCounterInput,
): Promise<Counter | null> {
  const set: Record<string, unknown> = {
    updatedAt: new Date(),
    lastActivityAt: new Date(),
  };

  if (input.title !== undefined) set.title = input.title.trim();
  if (input.description !== undefined)
    set.description = input.description?.trim() || null;
  if (input.counterMode !== undefined) set.counterMode = input.counterMode;
  if (input.cooldownEnabled !== undefined)
    set.cooldownEnabled = input.cooldownEnabled;
  if (input.cooldownSeconds !== undefined)
    set.cooldownSeconds = input.cooldownSeconds;
  if (input.goalsEnabled !== undefined) set.goalsEnabled = input.goalsEnabled;
  if (input.scoreboardEnabled !== undefined)
    set.scoreboardEnabled = input.scoreboardEnabled;
  if (input.isPublic !== undefined || input.visibilityMode !== undefined) {
    const visibilityMode = resolveCounterVisibility(input);

    set.isPublic = deriveLegacyIsPublic(visibilityMode);
    set.visibilityMode = visibilityMode;

    // Generate a share token when switching to private (if not already set)
    if (visibilityMode === "private") {
      const existing = await getCounter(counterId);
      if (existing && !existing.shareToken) {
        set.shareToken = generateShareToken();
      }
    }
  }

  const [updated] = await db
    .update(countersTable)
    .set(set)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
    .where(eq(countersTable.id, counterId as any))
    .returning();

  if (updated) {
    logger.info("Counter updated", { id: counterId });
  }

  return updated ?? null;
}

export async function transferCounterOwnership(
  counterId: string,
  newOwnerId: string | null,
): Promise<Counter | null> {
  const [updated] = await db
    .update(countersTable)
    .set({ ownerId: newOwnerId, updatedAt: new Date() })
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(countersTable.id, counterId as any))
    .returning();

  if (updated) {
    logger.info("Counter ownership transferred", {
      id: counterId,
      newOwnerId,
    });
  }

  return updated ?? null;
}

export async function deleteCounter(counterId: string): Promise<boolean> {
  const result = await db
    .delete(countersTable)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
    .where(eq(countersTable.id, counterId as any))
    .returning();

  if (result.length > 0) {
    logger.info("Counter deleted", { id: counterId });
  }

  return result.length > 0;
}

/**
 * Get all counters owned by or shared with a user.
 */
export async function getUserCounters(
  userId: string,
  limit?: number,
  offset = 0,
): Promise<{ items: Counter[]; total: number }> {
  const owned = await db
    .select()
    .from(countersTable)
    .where(eq(countersTable.ownerId, userId))
    .orderBy(desc(countersTable.updatedAt));

  const shared = await db
    .select({
      id: countersTable.id,
      title: countersTable.title,
      description: countersTable.description,
      count: countersTable.count,
      isPublic: countersTable.isPublic,
      visibilityMode: countersTable.visibilityMode,
      counterMode: countersTable.counterMode,
      shareToken: countersTable.shareToken,
      cooldownEnabled: countersTable.cooldownEnabled,
      cooldownSeconds: countersTable.cooldownSeconds,
      goalsEnabled: countersTable.goalsEnabled,
      scoreboardEnabled: countersTable.scoreboardEnabled,
      ownerId: countersTable.ownerId,
      createdAt: countersTable.createdAt,
      updatedAt: countersTable.updatedAt,
      lastActivityAt: countersTable.lastActivityAt,
    })
    .from(counterMembers)
    .innerJoin(countersTable, eq(counterMembers.counterId, countersTable.id))
    .where(eq(counterMembers.userId, userId))
    .orderBy(desc(countersTable.updatedAt));

  // Deduplicate (owner could also be a member)
  const seen = new Set(owned.map((c) => c.id));
  const all = [...owned, ...shared.filter((c) => !seen.has(c.id))];
  const total = all.length;

  if (limit !== undefined) {
    return { items: all.slice(offset, offset + limit), total };
  }
  return { items: all, total };
}

/**
 * List all counters (for admin dashboard).
 */
export async function listAllCounters(
  limit = 50,
  query?: string,
  offset = 0,
  sortBy?: string,
  sortOrder: "asc" | "desc" = "desc",
): Promise<{
  items: (Counter & { ownerName: string | null; actionCount: number })[];
  total: number;
}> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? or(
        ilike(countersTable.title, `%${escapeLikePattern(searchQuery)}%`),
        ilike(countersTable.description, `%${escapeLikePattern(searchQuery)}%`),
      )
    : undefined;

  const actionCount =
    sql<number>`(SELECT count(*) FROM counter_history WHERE counter_id = "counters"."id")`.as(
      "action_count",
    );

  const columnMap: Record<string, AnyColumn> = {
    title: countersTable.title,
    count: countersTable.count,
    visibility: countersTable.visibilityMode,
    owner: users.username,
    createdAt: countersTable.createdAt,
    updatedAt: countersTable.updatedAt,
    actions:
      sql`(SELECT count(*) FROM counter_history WHERE counter_id = "counters"."id")` as unknown as AnyColumn,
  };
  const sortColumn = sortBy && columnMap[sortBy];
  const orderByClause = sortColumn
    ? sortOrder === "asc"
      ? asc(sortColumn)
      : desc(sortColumn)
    : desc(countersTable.updatedAt);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        counter: countersTable,
        ownerUsername: users.username,
        ownerDisplayName: users.name,
        actionCount,
      })
      .from(countersTable)
      .leftJoin(users, eq(countersTable.ownerId, users.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(countersTable).where(whereClause),
  ]);

  const items = rows.map((row) => ({
    ...row.counter,
    ownerName: row.ownerUsername ?? row.ownerDisplayName ?? null,
    actionCount: Number(row.actionCount),
  }));

  return { items, total: Number(total) };
}

export async function getCounterSparkline(
  counterId: string,
): Promise<SparklinePoint[]> {
  const cached = sparklineCache.get(counterId);
  if (cached) return cached;

  const rows = await db.execute<{ day: string; value: number }>(sql`
    WITH counter_info AS (
      SELECT created_at, count
      FROM counters
      WHERE id = ${counterId}::uuid
    ),
    days AS (
      SELECT d::date AS day
      FROM counter_info,
           generate_series(
             (SELECT created_at::date FROM counter_info),
             CURRENT_DATE,
             '1 day'::interval
           ) AS d
    ),
    daily_values AS (
      SELECT
        d.day,
        (
          SELECT h.new_value
          FROM counter_history h
          WHERE h.counter_id = ${counterId}::uuid
            AND h.changed_at < (d.day + '1 day'::interval)
          ORDER BY h.changed_at DESC
          LIMIT 1
        ) AS value
      FROM days d
    )
    SELECT
      day::text,
      COALESCE(value, 0) AS value
    FROM daily_values
    ORDER BY day
  `);

  if (rows.length === 0) return [];

  const points: SparklinePoint[] = rows.map((r) => ({
    value: Number(r.value),
    timestamp: new Date(`${r.day}T00:00:00.000Z`).toISOString(),
  }));

  sparklineCache.set(counterId, points);
  return points;
}

export async function getGlobalActionCount(): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COUNT(*)` })
    .from(counterHistoryTable);
  return Number(row.total);
}

export async function getCounterCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(countersTable);
  return Number(row.count);
}

/**
 * Count how many counters a user owns.
 */
export async function getOwnedCounterCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: countFn() })
    .from(countersTable)
    .where(eq(countersTable.ownerId, userId));
  return Number(row?.count ?? 0);
}
