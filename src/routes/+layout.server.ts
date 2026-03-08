import { hasPermission } from "$lib/server/permissions";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = await locals.auth();

  let isAdmin = false;
  if (session?.user?.id) {
    isAdmin = await hasPermission(session.user.id, "user:manage");
  }

  return {
    session,
    isAdmin,
  };
};
