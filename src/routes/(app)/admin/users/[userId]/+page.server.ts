import { error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { roles } from "$lib/db/schema";
import { getUserDetail } from "$lib/server/users";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const userId = params.userId;

  const detail = await getUserDetail(userId);

  if (!detail) {
    throw error(404, "User not found");
  }

  const allRoles = await db.select().from(roles);

  return {
    detail,
    allRoles,
  };
};
