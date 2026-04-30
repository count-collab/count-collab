import { error, json } from "@sveltejs/kit";
import { asc, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { counterGoals } from "$lib/db/schema";
import { canEditCounter } from "$lib/server/authorize";
import { getCounter } from "$lib/server/counters";
import { logger } from "$lib/server/logger";
import { parseAndValidateBody } from "$lib/server/request";
import { counterIdSchema, createGoalSchema } from "$lib/utils/validation";
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

  const goals = await db
    .select()
    .from(counterGoals)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counterGoals.counterId, params.id as any))
    .orderBy(asc(counterGoals.amount));

  return json({ goals });
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to create goals");
  }

  const allowed = await canEditCounter(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to edit this counter");
  }

  const validation = await parseAndValidateBody(
    request,
    createGoalSchema,
    "Goal creation",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { amount, description } = validation.data;

  try {
    const [goal] = await db
      .insert(counterGoals)
      .values({
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        counterId: params.id as any,
        amount,
        description,
      })
      .returning();

    logger.info("Goal created", { counterId: params.id, goalId: goal.id });
    return json(goal, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("counter_goals_counter_amount_idx")
    ) {
      throw error(409, "A goal with this amount already exists");
    }
    logger.error("Failed to create goal", { counterId: params.id, err });
    throw error(500, "Failed to create goal");
  }
};
