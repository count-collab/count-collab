import { error, json } from "@sveltejs/kit";
import {
  canDeleteCounter,
  canEditCounter,
  canIncrementCounter,
  canViewPrivateCounter,
} from "$lib/server/authorize";
import {
  deleteCounter,
  getCounter,
  incrementCounter,
  updateCounter,
} from "$lib/server/counters";
import { logger } from "$lib/server/logger";
import { getUserRole } from "$lib/server/permissions";
import {
  RATE_LIMIT_CONFIG,
  RATE_LIMIT_CONFIG_UNAUTHENTICATED,
} from "$lib/server/ratelimit";
import { parseAndValidateBody } from "$lib/server/request";
import { emitCounterUpdate } from "$lib/utils/socket";
import {
  counterIdSchema,
  incrementCounterSchema,
  updateCounterSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({
  params,
  request,
  locals,
  url,
}) => {
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

  // Parse optional body for amount (body may be empty for simple +1 increments)
  let amount = 1;
  const contentType = request.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const validation = await parseAndValidateBody(
      request,
      incrementCounterSchema,
      "Counter increment",
    );
    if (!validation.success) {
      return validation.response;
    }
    amount = validation.data.amount ?? 1;
  }

  // Private counter access check
  const counter = await getCounter(params.id);
  if (!counter) {
    logger.warn("Increment failed: counter not found", { id: params.id });
    throw error(404, "Counter not found");
  }

  if (counter.visibilityMode === "public_readonly") {
    if (!userId) {
      throw error(403, "Sign in to increment this counter");
    }

    const canIncrement = await canIncrementCounter(userId, counter.id);
    if (!canIncrement) {
      throw error(403, "You don't have permission to increment this counter");
    }
  } else if (counter.visibilityMode === "private") {
    const token = url.searchParams.get("token");
    const hasValidToken =
      !!token && !!counter.shareToken && token === counter.shareToken;

    if (!hasValidToken) {
      if (userId) {
        const canView = await canViewPrivateCounter(userId, counter.id);
        if (!canView) {
          throw error(404, "Counter not found");
        }
      } else {
        throw error(404, "Counter not found");
      }
    }
  }

  // Validate counter mode
  if (counter.counterMode === "increment_only" && amount < 0) {
    throw error(400, "This counter only supports incrementing");
  }
  if (counter.counterMode === "decrement_only" && amount > 0) {
    throw error(400, "This counter only supports decrementing");
  }

  const updated = await incrementCounter(params.id, amount, userId);

  if (!updated) {
    logger.warn("Increment failed: counter not found", { id: params.id });
    throw error(404, "Counter not found");
  }

  emitCounterUpdate(updated.id, updated.count, updated.updatedAt);

  let cooldownSeconds = Math.ceil(
    (userId
      ? RATE_LIMIT_CONFIG["/api/counters/[id]"]
      : RATE_LIMIT_CONFIG_UNAUTHENTICATED["/api/counters/[id]"]
    ).windowMs / 1000,
  );

  if (userId) {
    const role = await getUserRole(userId);
    if (role === "admin") {
      cooldownSeconds = 0;
    }
  }

  return json({
    count: updated.count,
    updatedAt: updated.updatedAt,
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

  const { title, description, visibility, counterMode } = validation.data;
  const counter = await updateCounter(params.id, {
    title,
    description,
    visibilityMode: visibility,
    counterMode,
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
