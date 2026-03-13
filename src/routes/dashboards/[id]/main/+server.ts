import { json } from "@sveltejs/kit";
import { getDashboard, setMainDashboard } from "$lib/server/dashboards";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, locals }) => {
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

  // Only the owner can set the main dashboard
  if (dashboard.ownerId !== session.user.id) {
    return json(
      { error: "Only the dashboard owner can set it as main" },
      { status: 403 },
    );
  }

  const success = await setMainDashboard(session.user.id, dashboard.id);

  if (!success) {
    return json({ error: "Failed to set main dashboard" }, { status: 500 });
  }

  return json({ success: true });
};
