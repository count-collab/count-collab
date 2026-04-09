import { redirect } from "@sveltejs/kit";
import { getUserCounters } from "$lib/server/counters";
import { getUserDashboards } from "$lib/server/dashboards";
import {
  getFollowedCounters,
  getFollowedDashboards,
} from "$lib/server/followers";
import type { PageServerLoad } from "./$types";

const PER_PAGE = 16;

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const offset = (page - 1) * PER_PAGE;
  const { items, total } = await getUserCounters(
    session.user.id,
    PER_PAGE,
    offset,
  );

  const { items: dashboardItems } = await getUserDashboards(session.user.id);

  const followedCounters = await getFollowedCounters(session.user.id);
  const followedDashboards = await getFollowedDashboards(session.user.id);

  return {
    counters: items,
    dashboards: dashboardItems,
    followedCounters,
    followedDashboards,
    page,
    totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
};
