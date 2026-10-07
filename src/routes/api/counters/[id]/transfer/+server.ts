import { error, json } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";
import { parseAndValidateBody } from "$lib/server/request";
import { transferCounter } from "$lib/server/transfer";
import { counterIdSchema, transferSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to transfer counters");
  }

  const validation = await parseAndValidateBody(
    request,
    transferSchema,
    "Counter transfer",
  );
  if (!validation.success) {
    return validation.response;
  }

  const result = await transferCounter(
    session.user.id,
    params.id,
    validation.data.teamId,
  );
  if (!result.ok) {
    logger.warn("Counter transfer rejected", {
      counterId: params.id,
      status: result.status,
      message: result.message,
    });
    throw error(result.status, result.message);
  }

  return json({ success: true });
};
