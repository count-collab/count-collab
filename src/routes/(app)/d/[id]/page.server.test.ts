import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  getCounter: vi.fn(),
  getDashboardItems: vi.fn(),
  canViewDashboard: vi.fn(),
  canEditDashboard: vi.fn(),
  canDeleteDashboard: vi.fn(),
  canManageDashboardMembers: vi.fn(),
  getDashboardAccess: vi.fn(),
  canViewPrivateCounter: vi.fn(),
  canIncrementPrivateCounter: vi.fn(),
  canIncrementCounter: vi.fn(),
}));

vi.mock("$lib/db", () => ({ db: {} }));
vi.mock("$lib/server/dashboards", () => ({
  getDashboard: mocks.getDashboard,
}));
vi.mock("$lib/server/counters", () => ({ getCounter: mocks.getCounter }));
vi.mock("$lib/server/dashboard-items", () => ({
  getDashboardItems: mocks.getDashboardItems,
}));
vi.mock("$lib/server/dashboard-authorize", () => ({
  canViewDashboard: mocks.canViewDashboard,
  canEditDashboard: mocks.canEditDashboard,
  canDeleteDashboard: mocks.canDeleteDashboard,
  canManageDashboardMembers: mocks.canManageDashboardMembers,
  getDashboardAccess: mocks.getDashboardAccess,
}));
vi.mock("$lib/server/authorize", () => ({
  canViewPrivateCounter: mocks.canViewPrivateCounter,
  canIncrementPrivateCounter: mocks.canIncrementPrivateCounter,
  canIncrementCounter: mocks.canIncrementCounter,
}));
vi.mock("$lib/server/dashboard-invitations", () => ({
  getDashboardInvitations: vi.fn(async () => []),
}));
vi.mock("$lib/server/dashboard-members", () => ({
  getDashboardMembers: vi.fn(async () => []),
}));
vi.mock("$lib/server/followers", () => ({
  getDashboardFollowerCount: vi.fn(async () => 0),
  isFollowingDashboard: vi.fn(async () => false),
}));
vi.mock("$lib/server/team-authorize", () => ({ getActingTeamRole: vi.fn() }));
vi.mock("$lib/server/teams", () => ({
  getTeam: vi.fn(),
  listEditableTeams: vi.fn(async () => []),
}));
vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { load } from "./+page.server";

const ID = "4f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const COUNTER_ID = "5f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const TOKEN = "dash-secret-token";

const privateDashboard = {
  id: ID,
  title: "Ops",
  description: null,
  visibilityMode: "private",
  shareToken: TOKEN,
  ownerId: null,
  teamId: null,
};

const itemCounter = {
  id: COUNTER_ID,
  title: "Item",
  visibilityMode: "public",
  shareToken: null,
  ownerId: null,
  teamId: null,
};

type DashboardPageData = {
  dashboard: Record<string, unknown>;
  items: { counter: Record<string, unknown> | null }[];
  shareToken: string | null;
  hasValidToken: boolean;
};

function callLoad(userId: string | null, search = "") {
  return load({
    params: { id: ID },
    depends: vi.fn(),
    url: new URL(`http://localhost/d/${ID}${search}`),
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as unknown as Parameters<typeof load>[0]) as Promise<DashboardPageData>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDashboard.mockResolvedValue(privateDashboard);
  mocks.getDashboardItems.mockResolvedValue([
    { id: 1, counterId: COUNTER_ID },
  ]);
  mocks.getCounter.mockResolvedValue(itemCounter);
  mocks.canViewDashboard.mockResolvedValue(true);
  mocks.canEditDashboard.mockResolvedValue(false);
  mocks.canDeleteDashboard.mockResolvedValue(false);
  mocks.canManageDashboardMembers.mockResolvedValue(false);
  mocks.getDashboardAccess.mockResolvedValue(null);
});

describe("/d/[id] load share token exposure", () => {
  it("returns the token to managers outside the dashboard object", async () => {
    mocks.canManageDashboardMembers.mockResolvedValue(true);

    const data = await callLoad("owner");

    expect(data.shareToken).toBe(TOKEN);
    expect(data.dashboard).not.toHaveProperty("shareToken");
  });

  it("omits the token for a signed-in viewer", async () => {
    const data = await callLoad("viewer");

    expect(data.shareToken).toBeNull();
    expect(data.dashboard).not.toHaveProperty("shareToken");
    expect(JSON.stringify(data)).not.toContain(TOKEN);
  });

  it("omits the token for an anonymous holder of a valid token", async () => {
    const data = await callLoad(null, `?token=${TOKEN}`);

    expect(data.hasValidToken).toBe(true);
    expect(data.shareToken).toBeNull();
    expect(JSON.stringify(data)).not.toContain(TOKEN);
  });

  it("strips share tokens from counters embedded as dashboard items", async () => {
    mocks.getCounter.mockResolvedValue({ ...itemCounter, shareToken: "c-tok" });

    const data = await callLoad("viewer");

    expect(data.items[0].counter).not.toHaveProperty("shareToken");
    expect(JSON.stringify(data)).not.toContain("c-tok");
  });

  it.each([
    ["wrong-length", "?token=abc"],
    ["longer", `?token=${TOKEN}x`],
    ["empty", "?token="],
    ["missing", ""],
  ])("rejects a %s token for anonymous callers", async (_label, search) => {
    await expect(callLoad(null, search)).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 for a signed-in user without access", async () => {
    mocks.canViewDashboard.mockResolvedValue(false);

    await expect(callLoad("outsider")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects any token when the stored token is null", async () => {
    mocks.getDashboard.mockResolvedValue({
      ...privateDashboard,
      shareToken: null,
    });

    await expect(callLoad(null, "?token=null")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("ignores the token on public dashboards", async () => {
    mocks.getDashboard.mockResolvedValue({
      ...privateDashboard,
      visibilityMode: "public",
    });

    const data = await callLoad(null, `?token=${TOKEN}`);

    expect(data.hasValidToken).toBe(false);
    expect(data.shareToken).toBeNull();
    expect(data.dashboard).not.toHaveProperty("shareToken");
  });
});
