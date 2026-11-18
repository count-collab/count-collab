import { redirect } from "@sveltejs/kit";
import {
  getCounter,
  getCounterCount,
  getGlobalActionCount,
} from "$lib/server/counters";

const COFFEE_COUNTER_ID = "600cdb27-5261-4004-a1c3-458727c4501e";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends, parent, url }) => {
  const { session } = await parent();

  if (session?.user && !url.searchParams.has("landing")) {
    redirect(303, "/home");
  }

  depends("marketing:homepage-stats");

  const [globalSum, counterCount, coffeeCounter] = await Promise.all([
    getGlobalActionCount(),
    getCounterCount(),
    getCounter(COFFEE_COUNTER_ID),
  ]);

  return {
    globalSum,
    counterCount,
    coffeesCount: coffeeCounter?.count ?? 0,
  };
};
