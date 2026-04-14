import { error, json } from "@sveltejs/kit";
import { canManageMembers } from "$lib/server/authorize";
import { getCounterMembers, inviteUserByUsername } from "$lib/server/members";
import { parseAndValidateBody } from "$lib/server/request";
import { counterIdSchema, inviteMemberSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view members");
  }

  const allowed = await canManageMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to view members");
  }

  const members = await getCounterMembers(params.id);
  return json(members);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to invite members");
  }

  const allowed = await canManageMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to manage members");
  }

  const validation = await parseAndValidateBody(
    request,
    inviteMemberSchema,
    "Member invitation",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { username, role } = validation.data;
  const member = await inviteUserByUsername(params.id, username, role);

  if (!member) {
    return json({ error: "User not found" }, { status: 404 });
  }

  return json(member, { status: 201 });
};
