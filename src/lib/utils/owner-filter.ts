/** "all", "personal", or a team id. */
export type OwnerFilterValue = string;

type TeamOwned = { teamId?: string | null; teamName?: string | null };

export function collectTeams(
  items: TeamOwned[],
): { id: string; name: string }[] {
  const teams = new Map<string, string>();
  for (const item of items) {
    if (item.teamId && item.teamName) teams.set(item.teamId, item.teamName);
  }
  return [...teams]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function matchesOwnerFilter(
  item: TeamOwned,
  filter: OwnerFilterValue,
): boolean {
  if (filter === "all") return true;
  if (filter === "personal") return !item.teamId;
  return item.teamId === filter;
}
