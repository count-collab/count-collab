import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListUserTeams } = vi.hoisted(() => ({
  mockListUserTeams: vi.fn(),
}));

vi.mock("$lib/server/teams", () => ({
  listUserTeams: mockListUserTeams,
}));

import { load } from "./+page.server";

function callLoad(userId: string | null, search = "") {
  return load({
    url: new URL(`http://localhost/create${search}`),
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as unknown as Parameters<typeof load>[0]);
}

function userTeam(id: string, name: string, role: string) {
  return {
    id,
    name,
    description: null,
    createdAt: new Date(),
    role,
    memberCount: 3,
    counterCount: 2,
    dashboardCount: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListUserTeams.mockResolvedValue([]);
});

describe("/create load", () => {
  it("returns no teams for anonymous users", async () => {
    expect(await callLoad(null, "?type=counter")).toEqual({
      preselectedType: "counter",
      teams: [],
    });
    expect(mockListUserTeams).not.toHaveBeenCalled();
  });

  it.each([
    ["?type=counter", "counter"],
    ["?type=dashboard", "dashboard"],
    ["?type=team", "team"],
    ["?type=bogus", null],
    ["", null],
  ])("logged-in %s -> %s", async (search, expected) => {
    const result = await callLoad("user-1", search);
    expect(result?.preselectedType).toBe(expected);
  });

  it("ignores type=team for anonymous users", async () => {
    const result = await callLoad(null, "?type=team");
    expect(result?.preselectedType).toBeNull();
  });

  it("returns only editor+ teams with stats, in listUserTeams order", async () => {
    mockListUserTeams.mockResolvedValue([
      userTeam("t-1", "Alpha", "owner"),
      userTeam("t-2", "Beta", "viewer"),
      userTeam("t-3", "Gamma", "editor"),
      userTeam("t-4", "Delta", "admin"),
    ]);

    const result = await callLoad("user-1");

    expect(mockListUserTeams).toHaveBeenCalledWith("user-1");
    expect(result?.teams).toEqual([
      {
        id: "t-1",
        name: "Alpha",
        role: "owner",
        memberCount: 3,
        counterCount: 2,
        dashboardCount: 1,
      },
      {
        id: "t-3",
        name: "Gamma",
        role: "editor",
        memberCount: 3,
        counterCount: 2,
        dashboardCount: 1,
      },
      {
        id: "t-4",
        name: "Delta",
        role: "admin",
        memberCount: 3,
        counterCount: 2,
        dashboardCount: 1,
      },
    ]);
  });
});
