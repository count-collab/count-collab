import { error, json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { counterMembers } from "$lib/db/schema";
import { getCounter } from "$lib/server/counters";
import { followCounter, unfollowCounter } from "$lib/server/followers";
import { counterIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to follow counters");
  }

  const counter = await getCounter(params.id);
  if (!counter) {
    throw error(404, "Counter not found");
  }

  // Owners don't need to follow their own counters
  if (counter.ownerId === session.user.id) {
    return json({ already: true }, { status: 200 });
  }

  // Members don't need to follow counters they belong to
  const [memberRow] = await db
    .select({ id: counterMembers.id })
    .from(counterMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterMembers.counterId, params.id as any),
        eq(counterMembers.userId, session.user.id),
      ),
    );
  if (memberRow) {
    return json({ already: true }, { status: 200 });
  }

  const created = await followCounter(session.user.id, params.id);
  if (!created) {
    return json({ already: true }, { status: 200 });
  }

  return json({ success: true }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to unfollow counters");
  }

  const removed = await unfollowCounter(session.user.id, params.id);
  if (!removed) {
    throw error(404, "You are not following this counter");
  }

  return json({ success: true });
};
