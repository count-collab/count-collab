import { listPublicDashboards } from "$lib/server/dashboards";
import type { PageServerLoad } from "./$types";

const PER_PAGE = 16;

export const load: PageServerLoad = async ({ depends, url }) => {
  depends("dashboards:list");

  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const offset = (page - 1) * PER_PAGE;

  const { items, total } = await listPublicDashboards(PER_PAGE, query, offset);

  return {
    query,
    dashboards: items,
    page,
    totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
};
