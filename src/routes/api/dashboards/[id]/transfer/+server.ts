import { error, json } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";
import { parseAndValidateBody } from "$lib/server/request";
import { transferDashboard } from "$lib/server/transfer";
import { emitDashboardUpdated } from "$lib/utils/socket";
import { dashboardIdSchema, transferSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to transfer dashboards");
  }

  const validation = await parseAndValidateBody(
    request,
    transferSchema,
    "Dashboard transfer",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { teamId, counterIds } = validation.data;

  const result = await transferDashboard(
    session.user.id,
    params.id,
    teamId,
    counterIds,
  );
  if (!result.ok) {
    logger.warn("Dashboard transfer rejected", {
      dashboardId: params.id,
      status: result.status,
      message: result.message,
    });
    throw error(result.status, result.message);
  }

  emitDashboardUpdated(params.id);

  return json({ success: true });
};
