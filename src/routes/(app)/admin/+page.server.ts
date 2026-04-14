import { getAdminStats } from "$lib/server/users";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const stats = await getAdminStats();
  return { stats };
};
