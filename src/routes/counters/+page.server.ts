import { listPublicCounters } from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends }) => {
  depends("counters:list");

  return {
    counters: await listPublicCounters(100),
  };
};
