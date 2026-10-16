import { error, json } from "@sveltejs/kit";
import { canAssignTeamRole } from "$lib/roles";
import { parseAndValidateBody } from "$lib/server/request";
import {
  canViewTeam,
  getActingTeamRole,
  getUserTeamRole,
} from "$lib/server/team-authorize";
import {
  removeTeamMember,
  type TeamMemberActor,
  updateTeamMemberRole,
} from "$lib/server/team-members";
import { emitTeamMembershipChanged } from "$lib/utils/socket";
import { teamIdSchema, teamRoleSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage members");
  }

  const canView = await canViewTeam(session.user.id, params.id);
  if (!canView) {
    throw error(404, "Team not found");
  }

  const validation = await parseAndValidateBody(
    request,
    teamRoleSchema,
    "Team member role update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const [actingRole, currentRole] = await Promise.all([
    getActingTeamRole(session.user.id, params.id),
    getUserTeamRole(params.userId, params.id),
  ]);

  if (!currentRole) {
    throw error(404, "Member not found");
  }

  if (
    !actingRole ||
    !canAssignTeamRole(actingRole, currentRole, validation.data.role)
  ) {
    throw error(403, "You don't have permission to assign this role");
  }

  // Re-checked against locked rows; the check above is only for fast feedback
  const result = await updateTeamMemberRole(
    params.id,
    params.userId,
    validation.data.role,
    { userId: session.user.id, actingRole },
  );
  if (!result.ok) {
    return json({ error: result.message }, { status: result.status });
  }

  emitTeamMembershipChanged([params.userId], {
    teamId: params.id,
    reason: "role_changed",
  });

  return json(result.member);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage members");
  }

  // Leaving the team is allowed for any member
  const isSelf = session.user.id === params.userId;
  let actor: TeamMemberActor | undefined;
  if (!isSelf) {
    const canView = await canViewTeam(session.user.id, params.id);
    if (!canView) {
      throw error(404, "Team not found");
    }

    const [actingRole, currentRole] = await Promise.all([
      getActingTeamRole(session.user.id, params.id),
      getUserTeamRole(params.userId, params.id),
    ]);

    if (!currentRole) {
      throw error(404, "Member not found");
    }

    if (!actingRole || !canAssignTeamRole(actingRole, currentRole, null)) {
      throw error(403, "You don't have permission to remove this member");
    }

    actor = { userId: session.user.id, actingRole };
  }

  const result = await removeTeamMember(params.id, params.userId, actor);
  if (!result.ok) {
    return json({ error: result.message }, { status: result.status });
  }

  emitTeamMembershipChanged([params.userId], {
    teamId: params.id,
    reason: "removed",
  });

  return json({ success: true });
};
