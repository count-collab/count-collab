import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();
  return {
    isAuthenticated: !!session?.user?.id,
  };
};
