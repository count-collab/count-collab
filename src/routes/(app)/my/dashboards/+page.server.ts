import { redirect } from "@sveltejs/kit";
import {
  getOwnedDashboards,
  getSharedDashboards,
} from "$lib/server/dashboards";
import { getFollowedDashboards } from "$lib/server/followers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  const userId = session.user.id;

  const [ownedDashboards, sharedDashboards, followedDashboards] =
    await Promise.all([
      getOwnedDashboards(userId),
      getSharedDashboards(userId),
      getFollowedDashboards(userId),
    ]);

  return {
    ownedDashboards,
    sharedDashboards,
    followedDashboards,
  };
};
