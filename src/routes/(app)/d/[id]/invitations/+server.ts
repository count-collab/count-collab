import { error, json } from "@sveltejs/kit";
import { canManageDashboardMembers } from "$lib/server/dashboard-authorize";
import { getDashboardInvitations } from "$lib/server/dashboard-invitations";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view invitations");
  }

  const allowed = await canManageDashboardMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to view invitations");
  }

  const invitations = await getDashboardInvitations(params.id);
  return json(invitations);
};
