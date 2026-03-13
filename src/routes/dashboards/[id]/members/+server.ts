import { json } from "@sveltejs/kit";
import { canManageDashboardMembers } from "$lib/server/authorize";
import {
  getDashboardMembers,
  inviteDashboardUserByUsername,
} from "$lib/server/dashboard-members";
import { getDashboard } from "$lib/server/dashboards";
import { parseAndValidateBody } from "$lib/server/request";
import {
  dashboardIdSchema,
  inviteDashboardMemberSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    return json({ error: "Authentication required" }, { status: 401 });
  }

  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    return json({ error: "Invalid dashboard ID format" }, { status: 400 });
  }

  const dashboard = await getDashboard(params.id);
  if (!dashboard) {
    return json({ error: "Dashboard not found" }, { status: 404 });
  }

  const allowed = await canManageDashboardMembers(
    session.user.id,
    dashboard.id,
  );
  if (!allowed) {
    return json({ error: "Permission denied" }, { status: 403 });
  }

  const members = await getDashboardMembers(dashboard.id);
  return json(members);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    return json({ error: "Authentication required" }, { status: 401 });
  }

  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    return json({ error: "Invalid dashboard ID format" }, { status: 400 });
  }

  const dashboard = await getDashboard(params.id);
  if (!dashboard) {
    return json({ error: "Dashboard not found" }, { status: 404 });
  }

  const allowed = await canManageDashboardMembers(
    session.user.id,
    dashboard.id,
  );
  if (!allowed) {
    return json({ error: "Permission denied" }, { status: 403 });
  }

  const validation = await parseAndValidateBody(
    request,
    inviteDashboardMemberSchema,
    "Dashboard member invitation",
  );

  if (!validation.success) {
    return validation.response;
  }

  const { username, role } = validation.data;

  const member = await inviteDashboardUserByUsername(
    dashboard.id,
    username,
    role,
  );

  if (!member) {
    return json({ error: "User not found" }, { status: 404 });
  }

  return json(member, { status: 201 });
};
