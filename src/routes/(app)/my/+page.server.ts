import { redirect } from "@sveltejs/kit";
import {
  getOwnedCounters,
  getSharedCounters,
  getUserActionCount,
  getUserRecentActivity,
} from "$lib/server/counters";
import {
  getOwnedDashboards,
  getSharedDashboards,
} from "$lib/server/dashboards";
import {
  getFollowedCounters,
  getFollowedDashboards,
} from "$lib/server/followers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  const userId = session.user.id;

  const [
    ownedCounters,
    sharedCounters,
    ownedDashboards,
    sharedDashboards,
    followedCounters,
    followedDashboards,
    recentActivity,
    totalActions,
  ] = await Promise.all([
    getOwnedCounters(userId, 4),
    getSharedCounters(userId, 4),
    getOwnedDashboards(userId, 4),
    getSharedDashboards(userId, 4),
    getFollowedCounters(userId),
    getFollowedDashboards(userId),
    getUserRecentActivity(userId, 8),
    getUserActionCount(userId),
  ]);

  return {
    ownedCounters,
    sharedCounters,
    ownedDashboards,
    sharedDashboards,
    followedCounters,
    followedDashboards,
    recentActivity,
    totalActions,
  };
};
