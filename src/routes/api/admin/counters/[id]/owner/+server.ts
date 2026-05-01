import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "$lib/db";
import { users } from "$lib/db/schema";
import { transferCounterOwnership } from "$lib/server/counters";
import { hasPermission } from "$lib/server/permissions";
import { parseAndValidateBody } from "$lib/server/request";
import { counterIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

const transferOwnerSchema = z.object({
  ownerId: z.string().min(1).nullable(),
});

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Unauthorized");
  }

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) {
    throw error(403, "Forbidden");
  }

  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const validation = await parseAndValidateBody(
    request,
    transferOwnerSchema,
    "Transfer counter ownership",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { ownerId } = validation.data;

  if (ownerId !== null) {
    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(users.id, ownerId as any));

    if (!targetUser) {
      throw error(404, "Target user not found");
    }
  }

  const updated = await transferCounterOwnership(params.id, ownerId);
  if (!updated) {
    throw error(404, "Counter not found");
  }

  return json(updated);
};
