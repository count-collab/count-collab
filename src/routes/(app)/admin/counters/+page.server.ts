import { listAllCounters } from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

const PER_PAGE = 20;

export const load: PageServerLoad = async ({ url }) => {
  const query = url.searchParams.get("q") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const sort = url.searchParams.get("sort") ?? "updatedAt";
  const order =
    url.searchParams.get("order") === "asc"
      ? ("asc" as const)
      : url.searchParams.get("order") === "desc"
        ? ("desc" as const)
        : "desc";
  const offset = (page - 1) * PER_PAGE;

  const { items, total } = await listAllCounters(
    PER_PAGE,
    query,
    offset,
    sort,
    order,
  );

  return {
    counters: items,
    query,
    sort,
    order,
    page,
    totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
};
