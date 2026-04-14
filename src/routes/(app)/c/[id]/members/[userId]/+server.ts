import { error, json } from "@sveltejs/kit";
import { canManageMembers } from "$lib/server/authorize";
import { removeMember, updateMemberRole } from "$lib/server/members";
import { parseAndValidateBody } from "$lib/server/request";
import { counterIdSchema, updateMemberRoleSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage members");
  }

  const allowed = await canManageMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(404, "Counter not found");
  }

  const validation = await parseAndValidateBody(
    request,
    updateMemberRoleSchema,
    "Member role update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const updated = await updateMemberRole(
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
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage members");
  }

  // Allow self-removal or require manage permission
  const isSelf = session.user.id === params.userId;
  if (!isSelf) {
    const allowed = await canManageMembers(session.user.id, params.id);
    if (!allowed) {
      throw error(404, "Counter not found");
    }
  }

  const removed = await removeMember(params.id, params.userId);
  if (!removed) {
    throw error(404, "Member not found");
  }

  return json({ success: true });
};
