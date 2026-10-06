import { listAllTeams } from "$lib/server/teams";
import type { PageServerLoad } from "./$types";

const PER_PAGE = 20;

export const load: PageServerLoad = async ({ url }) => {
  const query = url.searchParams.get("q") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const offset = (page - 1) * PER_PAGE;

  const { items, total } = await listAllTeams(PER_PAGE, query, offset);

  return {
    teams: items,
    total,
    query,
    page,
    totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
};
