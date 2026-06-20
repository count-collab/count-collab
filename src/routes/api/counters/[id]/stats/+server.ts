import { error, json } from "@sveltejs/kit";
import { canViewPrivateCounter } from "$lib/server/authorize";
import {
  getCounter,
  getCounterAnonymousStats,
  getCounterUserStats,
} from "$lib/server/counters";
import { counterIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const counter = await getCounter(params.id);
  if (!counter) {
    throw error(404, "Counter not found");
  }

  const session = await locals.auth();
  const userId = session?.user?.id;
  const isPrivate = counter.visibilityMode === "private";

  if (isPrivate && userId) {
    const canView = await canViewPrivateCounter(userId, counter.id);
    if (!canView) {
      throw error(404, "Counter not found");
    }
  } else if (isPrivate && !userId) {
    throw error(404, "Counter not found");
  }

  const [userStats, anonymousStats] = await Promise.all([
    userId ? getCounterUserStats(params.id, userId) : null,
    getCounterAnonymousStats(params.id),
  ]);

  return json({ userStats, anonymousStats });
};
