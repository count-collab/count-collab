import {
  getUserCounters,
  listPublicCounters,
  listRecentlyCreatedCounters,
  listRecentlyUpdatedCounters,
} from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends, parent }) => {
  depends("counters:list");
  depends("counters:user");

  const { session } = await parent();
  const userId = session?.user?.id;

  const [popularResult, userResult, recentlyCreated, recentlyUpdated] =
    await Promise.all([
      listPublicCounters(12),
      userId
        ? getUserCounters(userId, 6)
        : Promise.resolve({ items: [], total: 0 }),
      listRecentlyCreatedCounters(),
      listRecentlyUpdatedCounters(),
    ]);

  return {
    popularCounters: popularResult.items,
    userCounters: userResult.items,
    recentlyCreated,
    recentlyUpdated,
  };
};
