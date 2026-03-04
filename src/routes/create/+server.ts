import { json } from "@sveltejs/kit";
import { createCounter } from "$lib/server/counters";
import { parseAndValidateBody } from "$lib/server/request";
import { emitCounterCreated } from "$lib/utils/socket";
import { createCounterSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const validation = await parseAndValidateBody(
    request,
    createCounterSchema,
    "Counter creation",
  );

  if (!validation.success) {
    return validation.response;
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
