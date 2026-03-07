import { listAllCounters } from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const query = url.searchParams.get("q") ?? undefined;
  const counters = await listAllCounters(50, query);

  return { counters, query };
};
