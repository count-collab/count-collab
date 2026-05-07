import { error, json } from "@sveltejs/kit";
import {
  acceptCounterInvitation,
  deleteCounterInvitation,
} from "$lib/server/invitations";
import { logger } from "$lib/server/logger";
import { emitInvitationDeleted } from "$lib/utils/socket";
import { counterIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.counterId);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to accept invitations");
  }

  const member = await acceptCounterInvitation(
    params.counterId,
    session.user.id,
  );
  if (!member) {
    throw error(404, "Invitation not found");
  }

  emitInvitationDeleted(session.user.id);

  logger.info("Counter invitation accepted via API", {
    counterId: params.counterId,
    userId: session.user.id,
  });

  return json(member, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.counterId);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to decline invitations");
  }

  const removed = await deleteCounterInvitation(
    params.counterId,
    session.user.id,
  );
  if (!removed) {
    throw error(404, "Invitation not found");
  }

  emitInvitationDeleted(session.user.id);

  return json({ success: true });
};
