import { error, redirect } from "@sveltejs/kit";
import { tokensEqual } from "$lib/server/crypto";
import { getUserTeamRole } from "$lib/server/team-authorize";
import { getTeam } from "$lib/server/teams";
import { teamIdSchema } from "$lib/utils/validation";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals, url }) => {
  const session = await locals.auth();
  const userId = session?.user?.id;

  if (!userId) {
    const redirectTo = encodeURIComponent(`${url.pathname}${url.search}`);
    throw redirect(303, `/login?redirectTo=${redirectTo}`);
  }

  if (!teamIdSchema.safeParse(params.id).success) {
    throw error(404, "Team not found");
  }

  const token = url.searchParams.get("token");
  const team = token ? await getTeam(params.id) : null;

  // Same 404 for missing team, disabled link and wrong token to avoid leaking existence
  if (!team?.joinToken || !token || !tokensEqual(team.joinToken, token)) {
    throw error(404, "Team not found");
  }

  const alreadyMember = !!(await getUserTeamRole(userId, team.id));

  return {
    team: { id: team.id, name: team.name },
    role: team.joinRole,
    alreadyMember,
  };
};
