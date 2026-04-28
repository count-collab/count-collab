import { redirect } from "@sveltejs/kit";
import {
  getCounter,
  getCounterCount,
  getGlobalActionCount,
  listPublicCounters,
} from "$lib/server/counters";

const COFFEE_COUNTER_ID = "600cdb27-5261-4004-a1c3-458727c4501e";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends, parent, url }) => {
  const { session } = await parent();

  if (session?.user && !url.searchParams.has("landing")) {
    redirect(303, "/home");
  }

  depends("counters:list");

  const [popularResult, globalSum, counterCount, coffeeCounter] =
    await Promise.all([
      listPublicCounters(6),
      getGlobalActionCount(),
      getCounterCount(),
      getCounter(COFFEE_COUNTER_ID),
    ]);

  return {
    popularCounters: popularResult.items,
    globalSum,
    counterCount,
    coffeesCount: coffeeCounter?.count ?? 0,
  };
};
