import { error, json } from "@sveltejs/kit";
import { parseAndValidateBody } from "$lib/server/request";
import { canManageTeam, canViewTeam } from "$lib/server/team-authorize";
import {
  disableJoinLink,
  enableOrRotateJoinLink,
  setJoinLinkRole,
} from "$lib/server/team-members";
import { joinLinkRoleSchema, teamIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

async function requireManage(
  locals: App.Locals,
  teamId: string,
): Promise<void> {
  if (!teamIdSchema.safeParse(teamId).success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to manage the join link");
  }

  if (await canManageTeam(session.user.id, teamId)) return;
  if (!(await canViewTeam(session.user.id, teamId))) {
    throw error(404, "Team not found");
  }
  throw error(403, "You don't have permission to manage the join link");
}

export const POST: RequestHandler = async ({ params, locals }) => {
  await requireManage(locals, params.id);

  const token = await enableOrRotateJoinLink(params.id);
  if (!token) {
    throw error(404, "Team not found");
  }

  return json({ token });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  await requireManage(locals, params.id);

  const validation = await parseAndValidateBody(
    request,
    joinLinkRoleSchema,
    "Team join link role update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const updated = await setJoinLinkRole(params.id, validation.data.role);
  if (!updated) {
    throw error(404, "Team not found");
  }

  return json({ role: validation.data.role });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  await requireManage(locals, params.id);

  const disabled = await disableJoinLink(params.id);
  if (!disabled) {
    throw error(404, "Team not found");
  }

  return json({ success: true });
};
