import { error, json } from "@sveltejs/kit";
import {
  getUserPendingInvitationCount,
  getUserPendingInvitations,
} from "$lib/server/invitations";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view invitations");
  }

  const [invitations, count] = await Promise.all([
    getUserPendingInvitations(session.user.id),
    getUserPendingInvitationCount(session.user.id),
  ]);

  return json({ invitations, count });
};
