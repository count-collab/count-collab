import { db } from "$lib/db";
import { roles } from "$lib/db/schema";
import { listUsers } from "$lib/server/users";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const query = url.searchParams.get("q") ?? undefined;
  const users = await listUsers(50, query);
  const allRoles = await db.select().from(roles);

  return { users, allRoles, query };
};
