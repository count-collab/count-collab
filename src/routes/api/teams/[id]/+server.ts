import { error, json } from "@sveltejs/kit";
import { parseAndValidateBody } from "$lib/server/request";
import {
  canDeleteTeam,
  canManageTeam,
  canViewTeam,
  getUserTeamRole,
} from "$lib/server/team-authorize";
import { getTeamMembers } from "$lib/server/team-members";
import { deleteTeam, getTeam, updateTeam } from "$lib/server/teams";
import { emitTeamMembershipChanged } from "$lib/utils/socket";
import {
  deleteTeamSchema,
  teamIdSchema,
  updateTeamSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view teams");
  }

  const allowed = await canViewTeam(session.user.id, params.id);
  if (!allowed) {
    throw error(404, "Team not found");
  }

  const team = await getTeam(params.id);
  if (!team) {
    throw error(404, "Team not found");
  }

  const [role, canManage] = await Promise.all([
    getUserTeamRole(session.user.id, params.id),
    canManageTeam(session.user.id, params.id),
  ]);

  return json({
    // The join token is a secret only managers may see
    team: canManage ? team : { ...team, joinToken: null },
    role,
  });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to edit teams");
  }

  const allowed = await canManageTeam(session.user.id, params.id);
  if (!allowed) {
    if (!(await canViewTeam(session.user.id, params.id))) {
      throw error(404, "Team not found");
    }
    throw error(403, "You don't have permission to edit this team");
  }

  const validation = await parseAndValidateBody(
    request,
    updateTeamSchema,
    "Team update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const team = await updateTeam(params.id, validation.data);
  if (!team) {
    throw error(404, "Team not found");
  }

  const members = await getTeamMembers(params.id);
  emitTeamMembershipChanged(
    members.map((m) => m.userId),
    { teamId: params.id, reason: "team_updated" },
  );

  return json(team);
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to delete teams");
  }

  const allowed = await canDeleteTeam(session.user.id, params.id);
  if (!allowed) {
    if (!(await canViewTeam(session.user.id, params.id))) {
      throw error(404, "Team not found");
    }
    throw error(403, "You don't have permission to delete this team");
  }

  const validation = await parseAndValidateBody(
    request,
    deleteTeamSchema,
    "Team deletion",
  );
  if (!validation.success) {
    return validation.response;
  }

  const team = await getTeam(params.id);
  if (!team) {
    throw error(404, "Team not found");
  }

  if (validation.data.confirmName !== team.name) {
    return json(
      { error: "Team name confirmation does not match" },
      { status: 400 },
    );
  }

  const result = await deleteTeam(params.id, session.user.id);
  if (!result.deleted) {
    throw error(404, "Team not found");
  }

  emitTeamMembershipChanged(result.memberIds, {
    teamId: params.id,
    reason: "team_deleted",
  });

  return json({
    success: true,
    counterIds: result.counterIds,
    dashboardIds: result.dashboardIds,
  });
};
