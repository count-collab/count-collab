import { error, json } from "@sveltejs/kit";
import { canAssignTeamRole } from "$lib/roles";
import {
  createTeamInvitation,
  getTeamInvitations,
} from "$lib/server/invitations";
import { logger } from "$lib/server/logger";
import { parseAndValidateBody } from "$lib/server/request";
import {
  canManageTeam,
  canViewTeam,
  getActingTeamRole,
  getUserTeamRole,
} from "$lib/server/team-authorize";
import {
  inviteAcceptedResponse,
  TeamLimitError,
  teamLimitResponse,
} from "$lib/server/team-limits";
import { getTeamMembers } from "$lib/server/team-members";
import { getUserByUsername } from "$lib/server/users";
import { teamIdSchema, teamInviteSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view members");
  }

  const allowed = await canViewTeam(session.user.id, params.id);
  if (!allowed) {
    throw error(404, "Team not found");
  }

  const [members, canManage] = await Promise.all([
    getTeamMembers(params.id),
    canManageTeam(session.user.id, params.id),
  ]);
  const invitations = canManage ? await getTeamInvitations(params.id) : [];

  return json({ members, invitations });
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to invite members");
  }

  const allowed = await canManageTeam(session.user.id, params.id);
  if (!allowed) {
    if (!(await canViewTeam(session.user.id, params.id))) {
      throw error(404, "Team not found");
    }
    throw error(403, "You don't have permission to invite members");
  }

  const validation = await parseAndValidateBody(
    request,
    teamInviteSchema,
    "Team member invitation",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { username, role } = validation.data;

  const actingRole = await getActingTeamRole(session.user.id, params.id);
  if (!canAssignTeamRole(actingRole, null, role)) {
    throw error(403, "You don't have permission to assign this role");
  }

  // Unknown users and existing members get the same answer as a real invite
  const user = await getUserByUsername(username);
  if (!user) {
    return inviteAcceptedResponse();
  }

  if (user.id === session.user.id) {
    return json({ error: "You cannot invite yourself" }, { status: 400 });
  }

  const existingRole = await getUserTeamRole(user.id, params.id);
  if (existingRole) {
    return inviteAcceptedResponse();
  }

  try {
    const invitation = await createTeamInvitation(
      params.id,
      user.id,
      role,
      session.user.id,
    );

    if (!invitation) {
      return json({ error: "Failed to create invitation" }, { status: 500 });
    }
  } catch (err) {
    if (err instanceof TeamLimitError) {
      logger.warn("Team invitation limit hit", {
        teamId: params.id,
        userId: session.user.id,
        code: err.code,
      });
      // Would otherwise reveal that the recipient exists and is swamped
      if (err.code === "pending_recipient_limit") {
        return inviteAcceptedResponse();
      }
      return teamLimitResponse(err);
    }
    throw err;
  }

  return inviteAcceptedResponse();
};
