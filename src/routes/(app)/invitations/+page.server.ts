import { redirect } from "@sveltejs/kit";
import { getUserPendingInvitations } from "$lib/server/invitations";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, depends }) => {
  depends("app:invitations");

  const session = await locals.auth();

  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  const invitations = await getUserPendingInvitations(session.user.id);

  return { invitations };
};
