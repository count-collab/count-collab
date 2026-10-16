import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetTeam, mockGetUserTeamRole } = vi.hoisted(() => ({
  mockGetTeam: vi.fn(),
  mockGetUserTeamRole: vi.fn(),
}));

vi.mock("$lib/server/teams", () => ({ getTeam: mockGetTeam }));
vi.mock("$lib/server/team-authorize", () => ({
  getUserTeamRole: mockGetUserTeamRole,
}));

import { load } from "./+page.server";

const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function callLoad(userId: string | null, search = "?token=good") {
  return load({
    params: { id: TEAM_ID },
    url: new URL(`http://localhost/t/${TEAM_ID}/join${search}`),
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as unknown as Parameters<typeof load>[0]) as Promise<
    Record<string, unknown>
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTeam.mockResolvedValue({
    id: TEAM_ID,
    name: "Alpha",
    joinToken: "good",
    joinRole: "incrementer",
  });
  mockGetUserTeamRole.mockResolvedValue(null);
});

describe("/t/[id]/join load", () => {
  it("redirects anonymous users to login preserving the token", async () => {
    await expect(callLoad(null)).rejects.toMatchObject({
      status: 303,
      location: `/login?redirectTo=${encodeURIComponent(
        `/t/${TEAM_ID}/join?token=good`,
      )}`,
    });
  });

  it("returns 404 without a token", async () => {
    await expect(callLoad("user-1", "")).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 for a wrong token", async () => {
    await expect(callLoad("user-1", "?token=bad")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns 404 when the join link is disabled", async () => {
    mockGetTeam.mockResolvedValue({
      id: TEAM_ID,
      name: "Alpha",
      joinToken: null,
      joinRole: "viewer",
    });

    await expect(callLoad("user-1")).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 when the team does not exist", async () => {
    mockGetTeam.mockResolvedValue(null);

    await expect(callLoad("user-1")).rejects.toMatchObject({ status: 404 });
  });

  it("returns team, join role and membership for a valid token", async () => {
    mockGetUserTeamRole.mockResolvedValue("viewer");

    expect(await callLoad("user-1")).toEqual({
      team: { id: TEAM_ID, name: "Alpha" },
      role: "incrementer",
      alreadyMember: true,
    });
  });
});
