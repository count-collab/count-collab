import { type CounterSort, listPublicCounters } from "$lib/server/counters";
import type { PageServerLoad } from "./$types";

const PER_PAGE = 16;
const VALID_SORTS: CounterSort[] = ["popular", "newest", "updated"];

export const load: PageServerLoad = async ({ depends, url }) => {
  depends("counters:list");

  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const sortParam = url.searchParams.get("sort");
  const sort: CounterSort = VALID_SORTS.includes(sortParam as CounterSort)
    ? (sortParam as CounterSort)
    : "popular";
  const offset = (page - 1) * PER_PAGE;

  const { items, total } = await listPublicCounters(
    PER_PAGE,
    query,
    offset,
    sort,
  );

  return {
    query,
    sort,
    counters: items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
};
