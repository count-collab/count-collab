import { error, json } from "@sveltejs/kit";
import { canAssignTeamRole } from "$lib/roles";
import {
  deleteTeamInvitation,
  getTeamInvitations,
  updateTeamInvitationRole,
} from "$lib/server/invitations";
import { parseAndValidateBody } from "$lib/server/request";
import {
  canManageTeam,
  canViewTeam,
  getActingTeamRole,
} from "$lib/server/team-authorize";
import {
  emitInvitationDeleted,
  emitInvitationUpdated,
} from "$lib/utils/socket";
import { teamIdSchema, teamRoleSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

async function requireManage(userId: string, teamId: string): Promise<void> {
  if (await canManageTeam(userId, teamId)) return;
  if (!(await canViewTeam(userId, teamId))) {
    throw error(404, "Team not found");
  }
  throw error(403, "You don't have permission to manage invitations");
}

async function getInvitationRole(teamId: string, userId: string) {
  const invitations = await getTeamInvitations(teamId);
  return invitations.find((i) => i.userId === userId)?.role ?? null;
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage invitations");
  }

  await requireManage(session.user.id, params.id);

  const validation = await parseAndValidateBody(
    request,
    teamRoleSchema,
    "Team invitation role update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const [actingRole, currentRole] = await Promise.all([
    getActingTeamRole(session.user.id, params.id),
    getInvitationRole(params.id, params.userId),
  ]);

  if (!currentRole) {
    throw error(404, "Invitation not found");
  }

  if (!canAssignTeamRole(actingRole, currentRole, validation.data.role)) {
    throw error(403, "You don't have permission to assign this role");
  }

  const updated = await updateTeamInvitationRole(
    params.id,
    params.userId,
    validation.data.role,
  );
  if (!updated) {
    throw error(404, "Invitation not found");
  }

  emitInvitationUpdated(params.userId);

  return json(updated);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage invitations");
  }

  await requireManage(session.user.id, params.id);

  const [actingRole, currentRole] = await Promise.all([
    getActingTeamRole(session.user.id, params.id),
    getInvitationRole(params.id, params.userId),
  ]);

  if (!currentRole) {
    throw error(404, "Invitation not found");
  }

  if (!canAssignTeamRole(actingRole, currentRole, null)) {
    throw error(403, "You don't have permission to cancel this invitation");
  }

  const removed = await deleteTeamInvitation(params.id, params.userId);
  if (!removed) {
    throw error(404, "Invitation not found");
  }

  emitInvitationDeleted(params.userId);

  return json({ success: true });
};
