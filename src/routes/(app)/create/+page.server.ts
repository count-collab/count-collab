import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }: { url: URL }) => {
  const type = url.searchParams.get("type");
  return {
    preselectedType: type === "counter" || type === "dashboard" ? type : null,
  };
};
