import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canViewTeam: vi.fn(),
  canManageTeam: vi.fn(),
  canDeleteTeam: vi.fn(),
  canEditTeamResources: vi.fn(),
  getActingTeamRole: vi.fn(),
  getTeam: vi.fn(),
  getTeamResources: vi.fn(),
  getTeamMembers: vi.fn(),
  getTeamInvitations: vi.fn(),
}));

vi.mock("$lib/server/team-authorize", () => ({
  canViewTeam: mocks.canViewTeam,
  canManageTeam: mocks.canManageTeam,
  canDeleteTeam: mocks.canDeleteTeam,
  canEditTeamResources: mocks.canEditTeamResources,
  getActingTeamRole: mocks.getActingTeamRole,
}));
vi.mock("$lib/server/teams", () => ({
  getTeam: mocks.getTeam,
  getTeamResources: mocks.getTeamResources,
}));
vi.mock("$lib/server/team-members", () => ({
  getTeamMembers: mocks.getTeamMembers,
}));
vi.mock("$lib/server/invitations", () => ({
  getTeamInvitations: mocks.getTeamInvitations,
}));
vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { load } from "./+page.server";

const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

const team = {
  id: TEAM_ID,
  name: "Alpha Team",
  description: null,
  joinToken: "secret-token",
  joinRole: "viewer",
  createdBy: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function callLoad(
  userId: string | null,
  { id = TEAM_ID, slug = "alpha-team", search = "" } = {},
) {
  const path = `/t/${id}${slug ? `/${slug}` : ""}`;
  return load({
    params: { id, slug },
    url: new URL(`http://localhost${path}${search}`),
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as unknown as Parameters<typeof load>[0]) as Promise<
    Record<string, unknown>
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canViewTeam.mockResolvedValue(true);
  mocks.canManageTeam.mockResolvedValue(false);
  mocks.canDeleteTeam.mockResolvedValue(false);
  mocks.canEditTeamResources.mockResolvedValue(false);
  mocks.getActingTeamRole.mockResolvedValue("viewer");
  mocks.getTeam.mockResolvedValue(team);
  mocks.getTeamResources.mockResolvedValue({ counters: [], dashboards: [] });
  mocks.getTeamMembers.mockResolvedValue([]);
  mocks.getTeamInvitations.mockResolvedValue([{ userId: "user-9" }]);
});

describe("/t/[id] load", () => {
  it("redirects anonymous users to login with redirectTo", async () => {
    await expect(
      callLoad(null, { search: "?tab=members" }),
    ).rejects.toMatchObject({
      status: 303,
      location: `/login?redirectTo=${encodeURIComponent(
        `/t/${TEAM_ID}/alpha-team?tab=members`,
      )}`,
    });
    expect(mocks.getTeam).not.toHaveBeenCalled();
  });

  it("returns 404 for an invalid id", async () => {
    await expect(callLoad("user-1", { id: "nope" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns 404 when the user cannot view the team", async () => {
    mocks.canViewTeam.mockResolvedValue(false);

    await expect(callLoad("user-1")).rejects.toMatchObject({ status: 404 });
    expect(mocks.getTeam).not.toHaveBeenCalled();
  });

  it("returns 404 when the team does not exist", async () => {
    mocks.getTeam.mockResolvedValue(null);

    await expect(callLoad("user-1")).rejects.toMatchObject({ status: 404 });
  });

  it("redirects to the canonical slug", async () => {
    await expect(
      callLoad("user-1", { slug: "old-name", search: "?x=1" }),
    ).rejects.toMatchObject({
      status: 301,
      location: `/t/${TEAM_ID}/alpha-team?x=1`,
    });
  });

  it("does not redirect into a reserved sibling route", async () => {
    mocks.getTeam.mockResolvedValue({ ...team, name: "Members" });

    const data = await callLoad("user-1", { slug: "" });

    expect(data.team).toMatchObject({ name: "Members" });
  });

  it("hides invitations and join link from non-managers", async () => {
    const data = await callLoad("user-1");

    expect(data).toMatchObject({
      role: "viewer",
      canManage: false,
      canDelete: false,
      canEditResources: false,
      invitations: [],
      joinToken: null,
      joinRole: null,
    });
    expect(data.team).not.toHaveProperty("joinToken");
    expect(mocks.getTeamInvitations).not.toHaveBeenCalled();
  });

  it("returns invitations and join link for managers", async () => {
    mocks.canManageTeam.mockResolvedValue(true);
    mocks.getActingTeamRole.mockResolvedValue("admin");

    const data = await callLoad("user-1");

    expect(data).toMatchObject({
      role: "admin",
      canManage: true,
      invitations: [{ userId: "user-9" }],
      joinToken: "secret-token",
      joinRole: "viewer",
      resources: { counters: [], dashboards: [] },
    });
  });
});
