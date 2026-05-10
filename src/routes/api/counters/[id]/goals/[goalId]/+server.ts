import { error, json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { counterGoals } from "$lib/db/schema";
import { canEditCounter } from "$lib/server/authorize";
import { logEvent } from "$lib/server/events";
import { logger } from "$lib/server/logger";
import { parseAndValidateBody } from "$lib/server/request";
import { counterIdSchema, updateGoalSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const goalId = Number(params.goalId);
  if (!Number.isFinite(goalId) || goalId < 1) {
    throw error(400, "Invalid goal ID");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to edit goals");
  }

  const allowed = await canEditCounter(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to edit this counter");
  }

  const validation = await parseAndValidateBody(
    request,
    updateGoalSchema,
    "Goal update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { amount, description } = validation.data;
  const set: Record<string, unknown> = {};
  if (amount !== undefined) set.amount = amount;
  if (description !== undefined) set.description = description;

  if (Object.keys(set).length === 0) {
    throw error(400, "No fields to update");
  }

  try {
    const [updated] = await db
      .update(counterGoals)
      .set(set)
      .where(
        and(
          eq(counterGoals.id, goalId),
          // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
          eq(counterGoals.counterId, params.id as any),
        ),
      )
      .returning();

    if (!updated) {
      throw error(404, "Goal not found");
    }

    logger.info("Goal updated", { counterId: params.id, goalId });
    return json(updated);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) throw err;
    if (
      err instanceof Error &&
      err.message.includes("counter_goals_counter_amount_idx")
    ) {
      throw error(409, "A goal with this amount already exists");
    }
    logger.error("Failed to update goal", {
      counterId: params.id,
      goalId,
      err,
    });
    throw error(500, "Failed to update goal");
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const goalId = Number(params.goalId);
  if (!Number.isFinite(goalId) || goalId < 1) {
    throw error(400, "Invalid goal ID");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to delete goals");
  }

  const allowed = await canEditCounter(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to edit this counter");
  }

  const result = await db
    .delete(counterGoals)
    .where(
      and(
        eq(counterGoals.id, goalId),
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterGoals.counterId, params.id as any),
      ),
    )
    .returning();

  if (result.length === 0) {
    throw error(404, "Goal not found");
  }

  logger.info("Goal deleted", { counterId: params.id, goalId });
  logEvent({
    eventType: "goal_deleted",
    userId: session.user.id,
    entityId: String(goalId),
    entityType: "goal",
    metadata: {
      counter_id: params.id,
      goal_amount: result[0].amount,
      goal_description: result[0].description,
      user_name: session.user.username ?? session.user.name ?? null,
    },
  });
  return new Response(null, { status: 204 });
};
