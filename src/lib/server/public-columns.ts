import { getTableColumns } from "drizzle-orm";
import { counters, dashboards } from "$lib/db/schema";

// Share tokens are secrets for managers; select these columns for every payload that can reach a non-manager.
const { shareToken: _counterShareToken, ...publicCounterColumns } =
  getTableColumns(counters);
const { shareToken: _dashboardShareToken, ...publicDashboardColumns } =
  getTableColumns(dashboards);

export { publicCounterColumns, publicDashboardColumns };

export function withoutShareToken<T extends { shareToken?: unknown }>(
  row: T,
): Omit<T, "shareToken"> {
  const { shareToken: _, ...rest } = row;
  return rest;
}
