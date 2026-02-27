import { json } from "@sveltejs/kit";
import { createCounter } from "$lib/server/counters";
import { logger } from "$lib/server/logger";
import { emitCounterCreated } from "$lib/utils/socket";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const visibility = body.visibility ?? "public";

  const errors: Record<string, string> = {};

  if (!title) {
    errors.title = "Title is required.";
  }

  if (Object.keys(errors).length > 0) {
    logger.warn("Counter creation validation failed", { errors });
    return json({ errors }, { status: 400 });
  }

  const counter = await createCounter({
    title,
    description,
    isPublic: visibility === "public",
  });

  emitCounterCreated(counter.id);

  return json({ id: counter.id }, { status: 201 });
};
