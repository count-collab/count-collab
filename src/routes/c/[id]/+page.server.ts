import { error } from "@sveltejs/kit";
import { getCounter, getCounterHistory } from "$lib/server/counters";
import { logger } from "$lib/server/logger";
import { counterIdSchema } from "$lib/utils/validation";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, depends }) => {
  // Validate UUID format
  const idValidation = counterIdSchema.safeParse(params.id);

  if (!idValidation.success) {
    logger.warn("Invalid counter ID format", { id: params.id });
    throw error(400, "Invalid counter ID format");
  }

  const counter = await getCounter(params.id);

  if (!counter) {
    logger.warn("Counter not found", { id: params.id });
    throw error(404, "Counter not found");
  }

  depends(`counter:${params.id}`);

  return {
    counter,
    history: await getCounterHistory(params.id),
    title: `${counter.title} | Count Collab`,
    description:
      counter.description ||
      `${counter.title} counter is currently at ${counter.count}`,
  };
};
