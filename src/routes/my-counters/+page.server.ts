import { redirect } from "@sveltejs/kit";
import { getUserCounters } from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  const counters = await getUserCounters(session.user.id);

  return {
    counters,
    title: "My Counters | Count Collab",
  };
};
