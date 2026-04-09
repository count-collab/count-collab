import { error, json } from "@sveltejs/kit";
import { canViewPrivateCounter } from "$lib/server/authorize";
import { getCounter, getCounterSparkline } from "$lib/server/counters";
import { counterIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals, setHeaders }) => {
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
      throw error(403, "You don't have access to this counter");
    }
  } else if (isPrivate && !userId) {
    throw error(403, "Sign in to view this private counter");
  }

  const points = await getCounterSparkline(params.id);

  setHeaders({
    "cache-control": !isPrivate
      ? "public, max-age=300"
      : "private, max-age=300",
  });

  return json(points);
};
