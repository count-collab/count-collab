import { error, json } from "@sveltejs/kit";
import { getDashboardAccess } from "$lib/server/dashboard-authorize";
import { getDashboard } from "$lib/server/dashboards";
import { followDashboard, unfollowDashboard } from "$lib/server/followers";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, locals, url }) => {
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

  // Private dashboards require a valid share token to follow
  if (dashboard.visibilityMode === "private") {
    const token = url.searchParams.get("token");
    if (!token || !dashboard.shareToken || token !== dashboard.shareToken) {
      throw error(
        403,
        "Cannot follow a private dashboard without a valid share token",
      );
    }
  }

  // Owners and members (direct or via team) don't need to follow
  const access = await getDashboardAccess(session.user.id, dashboard.id);
  if (access.isOwner || access.effectiveRole) {
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
