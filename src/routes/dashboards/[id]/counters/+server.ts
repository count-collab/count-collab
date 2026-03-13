import { json } from "@sveltejs/kit";
import { canEditDashboard } from "$lib/server/authorize";
import { getCounter } from "$lib/server/counters";
import {
  addCounterToDashboard,
  getDashboard,
  removeCounterFromDashboard,
} from "$lib/server/dashboards";
import { parseAndValidateBody } from "$lib/server/request";
import {
  addCounterToDashboardSchema,
  dashboardIdSchema,
  removeCounterFromDashboardSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

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

  const allowed = await canEditDashboard(session.user.id, dashboard.id);
  if (!allowed) {
    return json({ error: "Permission denied" }, { status: 403 });
  }

  const validation = await parseAndValidateBody(
    request,
    addCounterToDashboardSchema,
    "Add counter to dashboard",
  );

  if (!validation.success) {
    return validation.response;
  }

  const { counterId } = validation.data;

  // Verify the counter exists
  const counter = await getCounter(counterId);
  if (!counter) {
    return json({ error: "Counter not found" }, { status: 404 });
  }

  const success = await addCounterToDashboard(dashboard.id, counterId);

  if (!success) {
    return json(
      { error: "Dashboard has reached the maximum number of counters (100)" },
      { status: 400 },
    );
  }

  return json({ success: true }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
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
    removeCounterFromDashboardSchema,
    "Remove counter from dashboard",
  );

  if (!validation.success) {
    return validation.response;
  }

  const { counterId } = validation.data;
  const removed = await removeCounterFromDashboard(dashboard.id, counterId);

  if (!removed) {
    return json(
      { error: "Counter not found on this dashboard" },
      { status: 404 },
    );
  }

  return json({ success: true });
};
