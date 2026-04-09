import { error, json } from "@sveltejs/kit";
import { getUserDashboardRole } from "$lib/server/dashboard-members";
import { getDashboard } from "$lib/server/dashboards";
import { followDashboard, unfollowDashboard } from "$lib/server/followers";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to follow dashboards");
  }

  const dashboard = await getDashboard(params.id);
  if (!dashboard) {
    throw error(404, "Dashboard not found");
  }

  if (dashboard.visibilityMode === "private") {
    throw error(403, "Cannot follow a private dashboard");
  }

  if (dashboard.ownerId === session.user.id) {
    return json({ already: true }, { status: 200 });
  }

  const existingRole = await getUserDashboardRole(
    session.user.id,
    dashboard.id,
  );
  if (existingRole) {
    return json({ already: true }, { status: 200 });
  }

  const created = await followDashboard(session.user.id, params.id);
  if (!created) {
    return json({ already: true }, { status: 200 });
  }

  return json({ success: true }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to unfollow dashboards");
  }

  const removed = await unfollowDashboard(session.user.id, params.id);
  if (!removed) {
    throw error(404, "You are not following this dashboard");
  }

  return json({ success: true });
};
