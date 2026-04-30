import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
  const response = await fetch("/api/admin/settings");
  const settings = await response.json();
  return { settings };
};
