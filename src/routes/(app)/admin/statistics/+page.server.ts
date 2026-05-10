import { error } from "@sveltejs/kit";
import { hasPermission } from "$lib/server/permissions";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) throw error(401, "Sign in required");

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) throw error(403, "Admin access required");

  return {};
};
