import { json } from "@sveltejs/kit";
import { createCounter } from "$lib/server/counters";
import { logger } from "$lib/server/logger";
import { emitCounterCreated } from "$lib/utils/socket";
import { createCounterSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch (_error) {
    logger.warn("Counter creation: Invalid JSON payload");
    return json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validation = createCounterSchema.safeParse(body);

  if (!validation.success) {
    const errors = validation.error.flatten().fieldErrors;
    logger.warn("Counter creation validation failed", { errors });
    return json({ errors }, { status: 400 });
  }

  const { title, description, visibility } = validation.data;

  const counter = await createCounter({
    title,
    description,
    isPublic: visibility === "public",
  });

  emitCounterCreated(counter.id);

  return json({ id: counter.id }, { status: 201 });
};
