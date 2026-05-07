import { error, json } from "@sveltejs/kit";
import {
  acceptDashboardInvitation,
  deleteDashboardInvitation,
} from "$lib/server/dashboard-invitations";
import { logger } from "$lib/server/logger";
import { emitInvitationDeleted } from "$lib/utils/socket";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.dashboardId);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to accept invitations");
  }

  const member = await acceptDashboardInvitation(
    params.dashboardId,
    session.user.id,
  );
  if (!member) {
    throw error(404, "Invitation not found");
  }

  emitInvitationDeleted(session.user.id);

  logger.info("Dashboard invitation accepted via API", {
    dashboardId: params.dashboardId,
    userId: session.user.id,
  });

  return json(member, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.dashboardId);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to decline invitations");
  }

  const removed = await deleteDashboardInvitation(
    params.dashboardId,
    session.user.id,
  );
  if (!removed) {
    throw error(404, "Invitation not found");
  }

  emitInvitationDeleted(session.user.id);

  return json({ success: true });
};
