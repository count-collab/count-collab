import { listPublicCounters } from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends, url }) => {
  depends("counters:list");

  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  return {
    query,
    counters: await listPublicCounters(100, query),
  };
};
