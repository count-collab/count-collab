import { error, json } from "@sveltejs/kit";
import { canDeleteCounter, canEditCounter } from "$lib/server/authorize";
import {
  deleteCounter,
  incrementCounter,
  updateCounter,
} from "$lib/server/counters";
import { logger } from "$lib/server/logger";
import { getUserRole } from "$lib/server/permissions";
import { RATE_LIMIT_CONFIG } from "$lib/server/ratelimit";
import { parseAndValidateBody } from "$lib/server/request";
import { emitCounterUpdate } from "$lib/utils/socket";
import { counterIdSchema, updateCounterSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, locals }) => {
  // Validate UUID format
  const idValidation = counterIdSchema.safeParse(params.id);

  if (!idValidation.success) {
    logger.warn("Increment failed: invalid counter ID format", {
      id: params.id,
    });
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  const userId = session?.user?.id;

  const counter = await incrementCounter(params.id, 1, userId);

  if (!counter) {
    logger.warn("Increment failed: counter not found", { id: params.id });
    throw error(404, "Counter not found");
  }

  emitCounterUpdate(counter.id, counter.count, counter.updatedAt);

  let cooldownSeconds = Math.ceil(RATE_LIMIT_CONFIG["/c/[id]"].windowMs / 1000);

  if (userId) {
    const role = await getUserRole(userId);
    if (role === "admin") {
      cooldownSeconds = 0;
    }
  }

  return json({
    count: counter.count,
    updatedAt: counter.updatedAt,
    cooldownSeconds,
  });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to edit counters");
  }

  const allowed = await canEditCounter(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to edit this counter");
  }

  const validation = await parseAndValidateBody(
    request,
    updateCounterSchema,
    "Counter update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { title, description, visibility } = validation.data;
  const counter = await updateCounter(params.id, {
    title,
    description,
    isPublic:
      visibility === "public"
        ? true
        : visibility === "private"
          ? false
          : undefined,
  });

  if (!counter) {
    throw error(404, "Counter not found");
  }

  return json(counter);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to delete counters");
  }

  const allowed = await canDeleteCounter(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to delete this counter");
  }

  const deleted = await deleteCounter(params.id);
  if (!deleted) {
    throw error(404, "Counter not found");
  }

  return json({ success: true });
};
