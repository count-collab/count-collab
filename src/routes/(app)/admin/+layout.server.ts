import { redirect } from "@sveltejs/kit";
import { hasPermission } from "$lib/server/permissions";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) {
    throw redirect(303, "/home");
  }

  return { session };
};
