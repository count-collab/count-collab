import {
  getCounterCount,
  getGlobalCounterSum,
  getUserCounters,
  listPublicCounters,
  listRecentlyCreatedCounters,
  listRecentlyUpdatedCounters,
} from "$lib/server/counters";
import { getUserDashboards } from "$lib/server/dashboards";
import {
  getFollowedCounters,
  getFollowedDashboards,
} from "$lib/server/followers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ depends, parent }) => {
  depends("counters:list");
  depends("counters:user");

  const { session } = await parent();
  const userId = session?.user?.id;

  const [
    popularResult,
    userResult,
    recentlyCreated,
    recentlyUpdated,
    globalSum,
    counterCount,
    userDashboardResult,
    followedCounters,
    followedDashboards,
  ] = await Promise.all([
    listPublicCounters(12),
    userId
      ? getUserCounters(userId, 6)
      : Promise.resolve({ items: [], total: 0 }),
    listRecentlyCreatedCounters(),
    listRecentlyUpdatedCounters(),
    getGlobalCounterSum(),
    getCounterCount(),
    userId
      ? getUserDashboards(userId, 6)
      : Promise.resolve({ items: [], total: 0 }),
    userId ? getFollowedCounters(userId) : Promise.resolve([]),
    userId ? getFollowedDashboards(userId) : Promise.resolve([]),
  ]);

  return {
    popularCounters: popularResult.items,
    userCounters: userResult.items,
    userDashboards: userDashboardResult.items,
    followedCounters,
    followedDashboards,
    recentlyCreated,
    recentlyUpdated,
    globalSum,
    counterCount,
  };
};
