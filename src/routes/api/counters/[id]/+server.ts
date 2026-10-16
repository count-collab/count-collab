import { error, json } from "@sveltejs/kit";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "$lib/db";
import { counterGoals } from "$lib/db/schema";
import {
  canDeleteCounter,
  canEditCounter,
  canIncrementCounter,
  canIncrementPrivateCounter,
} from "$lib/server/authorize";
import {
  ANONYMOUS_MAX_INCREMENT,
  CounterOverflowError,
} from "$lib/server/counter-limits";
import {
  deleteCounter,
  getCounter,
  incrementCounter,
  updateCounter,
} from "$lib/server/counters";
import { logEvent } from "$lib/server/events";
import { logger } from "$lib/server/logger";
import { withoutShareToken } from "$lib/server/public-columns";
import {
  checkCounterCooldown,
  checkPrivateCounterCooldown,
  recordCounterCooldown,
} from "$lib/server/ratelimit";
import { parseAndValidateBody } from "$lib/server/request";
import { hasValidShareToken } from "$lib/server/share-token";
import { emitCounterUpdate, emitRoomRevoked } from "$lib/utils/socket";
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
  const token = url.searchParams.get("token");

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

  // Only private counters honour share tokens
  const hasValidToken = hasValidShareToken(counter, token);

  if (counter.visibilityMode === "public_readonly") {
    if (!userId) {
      throw error(403, "Sign in to increment this counter");
    }

    const canIncrement = await canIncrementCounter(userId, counter.id);
    if (!canIncrement) {
      throw error(403, "You don't have permission to increment this counter");
    }
  } else if (counter.visibilityMode === "private") {
    if (!hasValidToken) {
      if (!userId) {
        throw error(404, "Counter not found");
      }
      const access = await canIncrementPrivateCounter(userId, counter.id);
      if (access === "forbidden") {
        throw error(403, "You don't have permission to increment this counter");
      }
      if (access === "not_found") {
        throw error(404, "Counter not found");
      }
    }
  }

  const shouldUsePrivateCooldown = counter.visibilityMode === "private";

  // Validate counter mode
  if (counter.counterMode === "increment_only" && amount < 0) {
    throw error(400, "This counter only supports incrementing");
  }
  if (counter.counterMode === "decrement_only" && amount > 0) {
    throw error(400, "This counter only supports decrementing");
  }
  if (!userId && Math.abs(amount) > ANONYMOUS_MAX_INCREMENT) {
    throw error(
      400,
      `Sign in to change this counter by more than ${ANONYMOUS_MAX_INCREMENT}`,
    );
  }

  const cooldownCheck = shouldUsePrivateCooldown
    ? await checkPrivateCounterCooldown(params.id, userId, {
        cooldownEnabled: counter.cooldownEnabled ?? false,
        cooldownSeconds: counter.cooldownSeconds ?? 0,
      })
    : await checkCounterCooldown(params.id, userId, {
        cooldownEnabled: counter.cooldownEnabled ?? false,
        cooldownSeconds: counter.cooldownSeconds ?? 0,
        ownerId: counter.ownerId,
      });

  if (cooldownCheck.blocked) {
    return new Response(
      JSON.stringify({
        error: "Counter is in cooldown",
        retryAfterSeconds: cooldownCheck.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(cooldownCheck.retryAfterSeconds),
        },
      },
    );
  }

  let updated: Awaited<ReturnType<typeof incrementCounter>>;
  try {
    updated = await incrementCounter(params.id, amount, userId);
  } catch (err) {
    if (err instanceof CounterOverflowError) {
      logger.warn("Increment rejected: value out of range", {
        id: params.id,
        amount,
      });
      throw error(409, "Counter has reached its maximum or minimum value");
    }
    throw err;
  }

  if (!updated) {
    logger.warn("Increment failed: counter not found", { id: params.id });
    throw error(404, "Counter not found");
  }

  // Mark any newly-reached goals
  if (counter.goalsEnabled) {
    const unreachedGoals = await db
      .select()
      .from(counterGoals)
      .where(
        and(
          eq(counterGoals.counterId, params.id),
          isNull(counterGoals.reachedAt),
        ),
      );

    const previousCount = updated.count - amount;
    const nowReached = unreachedGoals.filter((g) => {
      if (counter.counterMode === "decrement_only") {
        // Was above goal, now at or below
        return previousCount > g.amount && updated.count <= g.amount;
      }
      if (g.amount < 0) {
        return previousCount > g.amount && updated.count <= g.amount;
      }
      // Was below goal, now at or above
      return previousCount < g.amount && updated.count >= g.amount;
    });

    if (nowReached.length > 0) {
      const now = new Date();
      for (const g of nowReached) {
        await db
          .update(counterGoals)
          .set({ reachedAt: now })
          .where(eq(counterGoals.id, g.id));

        logEvent({
          eventType: "goal_reached",
          userId: userId ?? null,
          entityId: String(g.id),
          entityType: "goal",
          metadata: {
            counter_id: params.id,
            counter_title: counter.title,
            goal_amount: g.amount,
            goal_description: g.description,
            user_name: session?.user?.username ?? null,
          },
        });
      }
    }

    // Clear reachedAt for goals that are no longer met
    const reachedGoals = await db
      .select()
      .from(counterGoals)
      .where(
        and(
          eq(counterGoals.counterId, params.id),
          isNotNull(counterGoals.reachedAt),
        ),
      );

    const noLongerReached = reachedGoals.filter((g) => {
      if (counter.counterMode === "decrement_only") {
        return updated.count > g.amount;
      }
      if (g.amount < 0) {
        return updated.count > g.amount;
      }
      return updated.count < g.amount;
    });

    if (noLongerReached.length > 0) {
      for (const g of noLongerReached) {
        await db
          .update(counterGoals)
          .set({ reachedAt: null })
          .where(eq(counterGoals.id, g.id));
      }
    }
  }

  const username = session?.user?.username ?? null;
  const cooldownSeconds = cooldownCheck.cooldownSeconds;
  emitCounterUpdate(
    updated.id,
    updated.count,
    updated.updatedAt,
    username,
    amount,
    cooldownSeconds,
    {
      visibilityMode: counter.visibilityMode,
      ownerId: counter.ownerId,
      teamId: counter.teamId,
    },
  );
  recordCounterCooldown(params.id);

  return json({
    count: updated.count,
    updatedAt: updated.updatedAt,
    cooldownSeconds,
    username,
    amount,
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

  const {
    title,
    description,
    visibility,
    counterMode,
    cooldownEnabled,
    cooldownSeconds,
    goalsEnabled,
    showAllReachedGoals,
    scoreboardEnabled,
  } = validation.data;
  const counter = await updateCounter(params.id, {
    title,
    description,
    visibilityMode: visibility,
    counterMode,
    cooldownEnabled,
    cooldownSeconds,
    goalsEnabled,
    showAllReachedGoals,
    scoreboardEnabled,
  });

  if (!counter) {
    throw error(404, "Counter not found");
  }

  // Sockets that joined while the counter was public must re-authorize
  if (visibility === "private") emitRoomRevoked("counter", counter.id);

  // Editors can PATCH but must not receive the manager-only share token
  return json(withoutShareToken(counter));
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

  const deleted = await deleteCounter(params.id, session.user.id);
  if (!deleted) {
    throw error(404, "Counter not found");
  }

  return json({ success: true });
};
