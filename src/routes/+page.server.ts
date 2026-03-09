import { getUserCounters, listPublicCounters } from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends, parent }) => {
  depends("counters:list");
  depends("counters:user");

  const { session } = await parent();
  const userId = session?.user?.id;

  const popularResult = await listPublicCounters(12);
  const userResult = userId
    ? await getUserCounters(userId, 6)
    : { items: [], total: 0 };

  return {
    popularCounters: popularResult.items,
    userCounters: userResult.items,
  };
};
