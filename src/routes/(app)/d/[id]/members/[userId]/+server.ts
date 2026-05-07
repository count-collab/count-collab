import { error, json } from "@sveltejs/kit";
import { canManageDashboardMembers } from "$lib/server/dashboard-authorize";
import {
  removeDashboardMember,
  updateDashboardMemberRole,
} from "$lib/server/dashboard-members";
import { parseAndValidateBody } from "$lib/server/request";
import {
  dashboardIdSchema,
  updateDashboardMemberRoleSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage members");
  }

  const allowed = await canManageDashboardMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to manage members");
  }

  const validation = await parseAndValidateBody(
    request,
    updateDashboardMemberRoleSchema,
    "Member role update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const updated = await updateDashboardMemberRole(
    params.id,
    params.userId,
    validation.data.role,
  );

  if (!updated) {
    throw error(404, "Member not found");
  }

  return json(updated);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage members");
  }

  // Allow self-removal or require manage permission
  const isSelf = session.user.id === params.userId;
  if (!isSelf) {
    const allowed = await canManageDashboardMembers(session.user.id, params.id);
    if (!allowed) {
      throw error(403, "You don't have permission to manage members");
    }
  }

  const removed = await removeDashboardMember(params.id, params.userId);
  if (!removed) {
    throw error(404, "Member not found");
  }

  return json({ success: true });
};
