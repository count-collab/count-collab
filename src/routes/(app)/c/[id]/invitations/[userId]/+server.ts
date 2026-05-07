import { error, json } from "@sveltejs/kit";
import { canManageMembers } from "$lib/server/authorize";
import {
  deleteCounterInvitation,
  updateCounterInvitationRole,
} from "$lib/server/invitations";
import { parseAndValidateBody } from "$lib/server/request";
import {
  emitInvitationDeleted,
  emitInvitationUpdated,
} from "$lib/utils/socket";
import {
  counterIdSchema,
  updateInvitationRoleSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage invitations");
  }

  const allowed = await canManageMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(404, "Counter not found");
  }

  const validation = await parseAndValidateBody(
    request,
    updateInvitationRoleSchema,
    "Invitation role update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const updated = await updateCounterInvitationRole(
    params.id,
    params.userId,
    validation.data.role,
  );

  if (!updated) {
    throw error(404, "Invitation not found");
  }

  emitInvitationUpdated(params.userId);

  return json(updated);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage invitations");
  }

  const allowed = await canManageMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(404, "Counter not found");
  }

  const removed = await deleteCounterInvitation(params.id, params.userId);
  if (!removed) {
    throw error(404, "Invitation not found");
  }

  emitInvitationDeleted(params.userId);

  return json({ success: true });
};
