import { error, json } from "@sveltejs/kit";
import { canManageMembers } from "$lib/server/authorize";
import { getCounterInvitations } from "$lib/server/invitations";
import { counterIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view invitations");
  }

  const allowed = await canManageMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(404, "Counter not found");
  }

  const invitations = await getCounterInvitations(params.id);
  return json(invitations);
};
