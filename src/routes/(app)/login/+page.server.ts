import { redirect } from "@sveltejs/kit";
import { safeRedirectPath } from "$lib/utils/redirect";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = await locals.auth();
  const raw = url.searchParams.get("redirectTo");

  if (session?.user) {
    redirect(303, safeRedirectPath(raw, "/home"));
  }

  return { redirectTo: safeRedirectPath(raw, "") || null };
};
