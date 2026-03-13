import { redirect } from "@sveltejs/kit";
import { getUserDashboards } from "$lib/server/dashboards";
import type { PageServerLoad } from "./$types";

const PER_PAGE = 16;

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = await locals.auth();

  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const offset = (page - 1) * PER_PAGE;
  const { items, total } = await getUserDashboards(
    session.user.id,
    PER_PAGE,
    offset,
  );

  return {
    dashboards: items,
    page,
    totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
};
