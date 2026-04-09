import { error, json } from "@sveltejs/kit";
import { canManageDashboardMembers } from "$lib/server/dashboard-authorize";
import {
  getDashboardMembers,
  inviteUserByUsername,
} from "$lib/server/dashboard-members";
import { parseAndValidateBody } from "$lib/server/request";
import {
  dashboardIdSchema,
  inviteDashboardMemberSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view members");
  }

  const allowed = await canManageDashboardMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to view members");
  }

  const members = await getDashboardMembers(params.id);
  return json(members);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to invite members");
  }

  const allowed = await canManageDashboardMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to manage members");
  }

  const validation = await parseAndValidateBody(
    request,
    inviteDashboardMemberSchema,
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
