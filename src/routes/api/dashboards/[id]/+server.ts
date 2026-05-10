import { error, json } from "@sveltejs/kit";
import {
  canDeleteDashboard,
  canEditDashboard,
  canViewDashboard,
} from "$lib/server/dashboard-authorize";
import {
  deleteDashboard,
  getDashboard,
  updateDashboard,
} from "$lib/server/dashboards";
import { parseAndValidateBody } from "$lib/server/request";
import { emitDashboardUpdated } from "$lib/utils/socket";
import {
  dashboardIdSchema,
  updateDashboardSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals, url }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const dashboard = await getDashboard(params.id);
  if (!dashboard) {
    throw error(404, "Dashboard not found");
  }

  if (dashboard.visibilityMode === "private") {
    const token = url.searchParams.get("token");
    const hasValidToken =
      !!token && !!dashboard.shareToken && token === dashboard.shareToken;

    if (!hasValidToken) {
      const session = await locals.auth();
      if (!session?.user?.id) {
        throw error(403, "Sign in to view this private dashboard");
      }

      const canView = await canViewDashboard(session.user.id, params.id);
      if (!canView) {
        throw error(403, "You don't have access to this dashboard");
      }
    }
  }

  return json(dashboard);
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to edit dashboards");
  }

  const allowed = await canEditDashboard(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to edit this dashboard");
  }

  const validation = await parseAndValidateBody(
    request,
    updateDashboardSchema,
    "Dashboard update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { title, description, visibility } = validation.data;
  const dashboard = await updateDashboard(params.id, {
    title,
    description,
    visibilityMode: visibility,
  });

  if (!dashboard) {
    throw error(404, "Dashboard not found");
  }

  emitDashboardUpdated(dashboard.id);

  return json(dashboard);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to delete dashboards");
  }

  const allowed = await canDeleteDashboard(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to delete this dashboard");
  }

  const deleted = await deleteDashboard(params.id, session.user.id);
  if (!deleted) {
    throw error(404, "Dashboard not found");
  }

  return json({ success: true });
};
