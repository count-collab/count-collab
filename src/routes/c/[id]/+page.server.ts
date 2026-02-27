import { error } from "@sveltejs/kit";
import { getCounter, getCounterHistory } from "$lib/server/counters";
import { logger } from "$lib/server/logger";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, depends }) => {
  const counter = await getCounter(params.id);

  if (!counter) {
    logger.warn("Counter not found", { id: params.id });
    throw error(404, "Counter not found");
  }

  depends(`counter:${params.id}`);

  return {
    counter,
    history: await getCounterHistory(params.id),
  };
};
