import { isTeamRoleAtLeast } from "$lib/roles";
import { listUserTeams } from "$lib/server/teams";
import type { PageServerLoad } from "./$types";

type PreselectedType = "counter" | "dashboard" | "team";

export const load: PageServerLoad = async ({ url, locals }) => {
  const type = url.searchParams.get("type");
  const session = await locals.auth();
  const userId = session?.user?.id;

  const teams = userId
    ? (await listUserTeams(userId))
        .filter((team) => isTeamRoleAtLeast(team.role, "editor"))
        .map(
          ({ id, name, role, memberCount, counterCount, dashboardCount }) => ({
            id,
            name,
            role,
            memberCount,
            counterCount,
            dashboardCount,
          }),
        )
    : [];

  let preselectedType: PreselectedType | null = null;
  if (type === "counter" || type === "dashboard") preselectedType = type;
  else if (type === "team" && userId) preselectedType = "team";

  return { preselectedType, teams };
};
