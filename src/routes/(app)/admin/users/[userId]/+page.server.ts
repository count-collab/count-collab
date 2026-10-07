import { error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { roles } from "$lib/db/schema";
import { getSoleOwnedTeams } from "$lib/server/teams";
import { getUserDetail } from "$lib/server/users";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const userId = params.userId;

  const detail = await getUserDetail(userId);

  if (!detail) {
    throw error(404, "User not found");
  }

  const [allRoles, soleOwnedTeams] = await Promise.all([
    db.select().from(roles),
    getSoleOwnedTeams(userId),
  ]);

  return {
    detail,
    allRoles,
    soleOwnedTeams,
  };
};
