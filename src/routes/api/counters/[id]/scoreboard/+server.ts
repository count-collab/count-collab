import { error, json } from "@sveltejs/kit";
import { count, desc, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { counterHistory, users } from "$lib/db/schema";
import { getCounter } from "$lib/server/counters";
import { counterIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const counter = await getCounter(params.id);
  if (!counter) {
    throw error(404, "Counter not found");
  }

  const scoreboard = await db
    .select({
      userId: counterHistory.changedBy,
      username: users.username,
      image: users.image,
      actionCount: count(counterHistory.id),
    })
    .from(counterHistory)
    .innerJoin(users, eq(counterHistory.changedBy, users.id))
    .where(
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      eq(counterHistory.counterId, params.id as any),
    )
    .groupBy(counterHistory.changedBy, users.username, users.image)
    .orderBy(desc(count(counterHistory.id)))
    .limit(20);

  return json({ scoreboard });
};
