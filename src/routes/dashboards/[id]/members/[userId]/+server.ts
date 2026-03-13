import { json } from "@sveltejs/kit";
import { canManageDashboardMembers } from "$lib/server/authorize";
import { removeDashboardMember } from "$lib/server/dashboard-members";
import { getDashboard } from "$lib/server/dashboards";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async ({ params, locals }) => {
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

  // Cannot remove the owner
  if (params.userId === dashboard.ownerId) {
    return json(
      { error: "Cannot remove the dashboard owner" },
      { status: 400 },
    );
  }

  const removed = await removeDashboardMember(dashboard.id, params.userId);

  if (!removed) {
    return json({ error: "Member not found" }, { status: 404 });
  }

  return json({ success: true });
};
