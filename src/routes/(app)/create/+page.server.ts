import { listEditableTeams } from "$lib/server/teams";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url, locals }) => {
  const type = url.searchParams.get("type");
  const session = await locals.auth();
  const teams = session?.user?.id
    ? await listEditableTeams(session.user.id)
    : [];

  return {
    preselectedType: type === "counter" || type === "dashboard" ? type : null,
    teams,
  };
};
