import { error, json } from "@sveltejs/kit";
import { canManageDashboardMembers } from "$lib/server/dashboard-authorize";
import {
  deleteDashboardInvitation,
  updateDashboardInvitationRole,
} from "$lib/server/dashboard-invitations";
import { parseAndValidateBody } from "$lib/server/request";
import {
  emitInvitationDeleted,
  emitInvitationUpdated,
} from "$lib/utils/socket";
import {
  dashboardIdSchema,
  updateDashboardInvitationRoleSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage invitations");
  }

  const allowed = await canManageDashboardMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to manage invitations");
  }

  const validation = await parseAndValidateBody(
    request,
    updateDashboardInvitationRoleSchema,
    "Invitation role update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const updated = await updateDashboardInvitationRole(
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
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage invitations");
  }

  const allowed = await canManageDashboardMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to manage invitations");
  }

  const removed = await deleteDashboardInvitation(params.id, params.userId);
  if (!removed) {
    throw error(404, "Invitation not found");
  }

  emitInvitationDeleted(params.userId);

  return json({ success: true });
};
