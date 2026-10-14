import { error, json } from "@sveltejs/kit";
import {
  acceptTeamInvitation,
  deleteTeamInvitation,
} from "$lib/server/invitations";
import { logger } from "$lib/server/logger";
import { TeamLimitError, teamLimitResponse } from "$lib/server/team-limits";
import {
  emitInvitationDeleted,
  emitTeamMembershipChanged,
} from "$lib/utils/socket";
import { teamIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.teamId);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to accept invitations");
  }

  let member: Awaited<ReturnType<typeof acceptTeamInvitation>>;
  try {
    member = await acceptTeamInvitation(params.teamId, session.user.id);
  } catch (err) {
    if (err instanceof TeamLimitError) {
      return teamLimitResponse(err);
    }
    throw err;
  }
  if (!member) {
    throw error(404, "Invitation not found");
  }

  emitInvitationDeleted(session.user.id);
  emitTeamMembershipChanged([session.user.id], {
    teamId: params.teamId,
    reason: "joined",
  });

  logger.info("Team invitation accepted via API", {
    teamId: params.teamId,
    userId: session.user.id,
  });

  return json(member, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.teamId);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to decline invitations");
  }

  const removed = await deleteTeamInvitation(params.teamId, session.user.id);
  if (!removed) {
    throw error(404, "Invitation not found");
  }

  emitInvitationDeleted(session.user.id);

  return json({ success: true });
};
