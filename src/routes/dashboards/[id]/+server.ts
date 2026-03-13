import { json } from "@sveltejs/kit";
import { canDeleteDashboard, canEditDashboard } from "$lib/server/authorize";
import {
  deleteDashboard,
  getDashboard,
  updateDashboard,
} from "$lib/server/dashboards";
import { parseAndValidateBody } from "$lib/server/request";
import {
  dashboardIdSchema,
  updateDashboardSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
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

  const allowed = await canEditDashboard(session.user.id, dashboard.id);
  if (!allowed) {
    return json({ error: "Permission denied" }, { status: 403 });
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

  const updated = await updateDashboard(dashboard.id, {
    title,
    description,
    isPublic:
      visibility === "public"
        ? true
        : visibility === "private"
          ? false
          : undefined,
  });

  return json(updated);
};

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

  const allowed = await canDeleteDashboard(session.user.id, dashboard.id);
  if (!allowed) {
    return json({ error: "Permission denied" }, { status: 403 });
  }

  await deleteDashboard(dashboard.id);

  return json({ success: true });
};
