import { redirect } from "@sveltejs/kit";
import { getOwnedCounters, getSharedCounters } from "$lib/server/counters";
import { getFollowedCounters } from "$lib/server/followers";
import type { PageServerLoad } from "./$types";

const PER_PAGE = 16;

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  const userId = session.user.id;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const offset = (page - 1) * PER_PAGE;

  const [ownedCounters, sharedCounters, followedCounters] = await Promise.all([
    getOwnedCounters(userId, PER_PAGE, offset),
    getSharedCounters(userId),
    getFollowedCounters(userId),
  ]);

  return {
    ownedCounters,
    sharedCounters,
    followedCounters,
    page,
    totalPages: Math.max(1, Math.ceil(ownedCounters.total / PER_PAGE)),
  };
};
