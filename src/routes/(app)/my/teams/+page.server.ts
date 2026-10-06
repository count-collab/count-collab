import { redirect } from "@sveltejs/kit";
import { listUserTeams } from "$lib/server/teams";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  return { teams: await listUserTeams(session.user.id) };
};
