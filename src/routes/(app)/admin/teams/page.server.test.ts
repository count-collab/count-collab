import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("$lib/server/teams", () => ({
  listAllTeams: vi.fn(),
}));

import { listAllTeams } from "$lib/server/teams";
import { load } from "./+page.server";

const mockListAllTeams = listAllTeams as Mock;

async function callLoad(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/admin/teams");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return (await load({ url } as unknown as Parameters<typeof load>[0])) as {
    teams: unknown[];
    total: number;
    query: string | undefined;
    page: number;
    totalPages: number;
  };
}

describe("admin teams load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAllTeams.mockResolvedValue({ items: [], total: 0 });
  });

  it("defaults to the first page without a query", async () => {
    const result = await callLoad();

    expect(mockListAllTeams).toHaveBeenCalledWith(20, undefined, 0);
    expect(result).toEqual({
      teams: [],
      total: 0,
      query: undefined,
      page: 1,
      totalPages: 1,
    });
  });

  it("passes the search query and page offset", async () => {
    const team = { id: "t1", name: "Core", memberCount: 2 };
    mockListAllTeams.mockResolvedValue({ items: [team], total: 45 });

    const result = await callLoad({ q: "core", page: "3" });

    expect(mockListAllTeams).toHaveBeenCalledWith(20, "core", 40);
    expect(result.teams).toEqual([team]);
    expect(result.total).toBe(45);
    expect(result.query).toBe("core");
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
  });

  it("clamps invalid page values to 1", async () => {
    for (const page of ["0", "-2", "abc"]) {
      const result = await callLoad({ page });
      expect(result.page).toBe(1);
    }
    expect(mockListAllTeams).toHaveBeenCalledWith(20, undefined, 0);
  });
});
