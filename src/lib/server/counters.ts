import { and, count as countFn, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "$lib/db";
import type {
  Counter,
  CounterHistory,
  NewCounter,
  NewCounterHistory,
} from "$lib/db/schema";
import {
  counterHistory as counterHistoryTable,
  counterMembers,
  counters as countersTable,
} from "$lib/db/schema";
import { logger } from "$lib/server/logger";

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

    return updated;
  });
}

export async function getCounterHistory(
  counterId: string,
  limit = 10,
): Promise<CounterHistory[]> {
  return await db
    .select()
    .from(counterHistoryTable)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch with string
    .where(eq(counterHistoryTable.counterId, counterId as any))
    .orderBy(desc(counterHistoryTable.changedAt))
    .limit(limit);
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
  if (input.isPublic !== undefined) set.isPublic = input.isPublic ? 1 : 0;

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
