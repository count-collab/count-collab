import crypto from "node:crypto";
import { and, count as countFn, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "$lib/db";
import type {
  Counter,
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
import { logger } from "$lib/server/logger";

export const sparklineCache = createCache<SparklinePoint[]>({
  ttlMs: 300_000,
  maxSize: 500,
});

export function generateShareToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

type CreateCounterInput = {
  title: string;
  description?: string | null;
  isPublic: boolean;
  ownerId?: string | null;
};

export async function createCounter(
  input: CreateCounterInput,
): Promise<Counter> {
  const newCounter: NewCounter = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    count: 0,
    isPublic: input.isPublic ? 1 : 0,
    shareToken: input.isPublic ? null : generateShareToken(),
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
      eq(countersTable.isPublic, 1),
      or(
        ilike(countersTable.title, `%${escapeLikePattern(searchQuery)}%`),
        ilike(
          countersTable.description,
          `%${escapeLikePattern(searchQuery)}%`,
        ),
      ),
    )
    : eq(countersTable.isPublic, 1);

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(countersTable)
      .where(whereClause)
      .orderBy(desc(countersTable.count), desc(countersTable.updatedAt))
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
    .where(eq(countersTable.isPublic, 1))
    .orderBy(desc(countersTable.createdAt))
    .limit(limit);
}

export async function listRecentlyUpdatedCounters(
  limit = 6,
): Promise<Counter[]> {
  return db
    .select()
    .from(countersTable)
    .where(eq(countersTable.isPublic, 1))
    .orderBy(desc(countersTable.updatedAt))
    .limit(limit);
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
  limit = 10,
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
  description?: string;
  isPublic?: boolean;
};

export async function updateCounter(
  counterId: string,
  input: UpdateCounterInput,
): Promise<Counter | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) set.title = input.title.trim();
  if (input.description !== undefined)
    set.description = input.description.trim() || null;
  if (input.isPublic !== undefined) {
    set.isPublic = input.isPublic ? 1 : 0;
    // Generate a share token when switching to private (if not already set)
    if (!input.isPublic) {
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
      shareToken: countersTable.shareToken,
      ownerId: countersTable.ownerId,
      createdAt: countersTable.createdAt,
      updatedAt: countersTable.updatedAt,
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
): Promise<{ items: Counter[]; total: number }> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? or(
      ilike(countersTable.title, `%${escapeLikePattern(searchQuery)}%`),
      ilike(countersTable.description, `%${escapeLikePattern(searchQuery)}%`),
    )
    : undefined;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(countersTable)
      .where(whereClause)
      .orderBy(desc(countersTable.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: countFn() }).from(countersTable).where(whereClause),
  ]);

  return { items, total: Number(total) };
}

export async function getCounterSparkline(
  counterId: string,
  maxPoints = 50,
): Promise<SparklinePoint[]> {
  const cached = sparklineCache.get(counterId);
  if (cached) return cached;

  const [counterRows, rows] = await Promise.all([
    db
      .select({
        createdAt: countersTable.createdAt,
        count: countersTable.count,
      })
      .from(countersTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
      .where(eq(countersTable.id, counterId as any)),
    db
      .select({
        newValue: counterHistoryTable.newValue,
        changedAt: counterHistoryTable.changedAt,
      })
      .from(counterHistoryTable)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
      .where(eq(counterHistoryTable.counterId, counterId as any))
      .orderBy(desc(counterHistoryTable.changedAt))
      .limit(2000),
  ]);

  const counter = counterRows[0] ?? null;
  if (!counter) return [];

  // Reverse to chronological order (query fetches most recent first)
  rows.reverse();

  // Start with creation point (value 0)
  const createdAt = new Date(counter.createdAt);
  const rawPoints: SparklinePoint[] = [
    { value: 0, timestamp: createdAt.toISOString() },
  ];

  for (const r of rows) {
    rawPoints.push({
      value: r.newValue,
      timestamp: r.changedAt.toISOString(),
    });
  }

  // If sparse enough, return raw points directly — no bucketing needed
  if (rawPoints.length <= maxPoints) {
    sparklineCache.set(counterId, rawPoints);
    return rawPoints;
  }

  // Too many points — sample evenly, always keeping first and last
  const sampled: SparklinePoint[] = [];
  const step = (rawPoints.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    sampled.push(rawPoints[idx]);
  }
  sparklineCache.set(counterId, sampled);
  return sampled;
}
