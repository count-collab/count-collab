import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetDashboard, mockGetDashboardAccess, mockFollowDashboard } =
  vi.hoisted(() => ({
    mockGetDashboard: vi.fn(),
    mockGetDashboardAccess: vi.fn(),
    mockFollowDashboard: vi.fn(),
  }));

vi.mock("$lib/server/dashboards", () => ({ getDashboard: mockGetDashboard }));
vi.mock("$lib/server/dashboard-authorize", () => ({
  getDashboardAccess: mockGetDashboardAccess,
}));
vi.mock("$lib/server/followers", () => ({
  followDashboard: mockFollowDashboard,
  unfollowDashboard: vi.fn(),
}));

import { POST } from "./+server";

const DASHBOARD_ID = "2f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(userId: string | null) {
  return {
    params: { id: DASHBOARD_ID },
    url: new URL(`http://localhost/api/dashboards/${DASHBOARD_ID}/follow`),
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as any;
}

function access(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    isOwner: false,
    teamId: null,
    directRole: null,
    teamRole: null,
    effectiveRole: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDashboard.mockResolvedValue({
    id: DASHBOARD_ID,
    visibilityMode: "public",
    ownerId: "owner-1",
  });
});

describe("POST /api/dashboards/[id]/follow", () => {
  it("returns already for the personal owner", async () => {
    mockGetDashboardAccess.mockResolvedValue(access({ isOwner: true }));

    const response = await POST(makeEvent("owner-1"));

    expect(await response.json()).toEqual({ already: true });
    expect(mockFollowDashboard).not.toHaveBeenCalled();
  });

  it("returns already for team members", async () => {
    mockGetDashboardAccess.mockResolvedValue(
      access({ teamId: "team-1", teamRole: "editor", effectiveRole: "editor" }),
    );

    const response = await POST(makeEvent("user-2"));

    expect(await response.json()).toEqual({ already: true });
    expect(mockGetDashboardAccess).toHaveBeenCalledWith("user-2", DASHBOARD_ID);
    expect(mockFollowDashboard).not.toHaveBeenCalled();
  });

  it("follows when the user has no access role", async () => {
    mockGetDashboardAccess.mockResolvedValue(access());
    mockFollowDashboard.mockResolvedValue(true);

    const response = await POST(makeEvent("user-3"));

    expect(response.status).toBe(201);
    expect(mockFollowDashboard).toHaveBeenCalledWith("user-3", DASHBOARD_ID);
  });
});
