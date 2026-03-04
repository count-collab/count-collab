import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "$lib/db";
import type { Counter, CounterHistory, NewCounter, NewCounterHistory } from "$lib/db/schema";
import { counterHistory as counterHistoryTable, counters as countersTable } from "$lib/db/schema";
import { logger } from "$lib/server/logger";

type CreateCounterInput = {
  title: string;
  description?: string | null;
  isPublic: boolean;
};

export async function createCounter(input: CreateCounterInput): Promise<Counter> {
  const newCounter: NewCounter = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    count: 0,
    isPublic: input.isPublic ? 1 : 0,
  };

  const [counter] = await db.insert(countersTable).values(newCounter).returning();

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
): Promise<Counter[]> {
  const searchQuery = query?.trim();
  const whereClause = searchQuery
    ? and(
      eq(countersTable.isPublic, 1),
      or(
        ilike(countersTable.title, `%${searchQuery}%`),
        ilike(countersTable.description, `%${searchQuery}%`),
      ),
    )
    : eq(countersTable.isPublic, 1);

  return await db
    .select()
    .from(countersTable)
    .where(whereClause)
    .orderBy(desc(countersTable.count), desc(countersTable.updatedAt))
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
