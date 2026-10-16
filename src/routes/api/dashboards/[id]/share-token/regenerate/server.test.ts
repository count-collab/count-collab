import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCanManageDashboardMembers, mockRegenerate } = vi.hoisted(() => ({
  mockCanManageDashboardMembers: vi.fn(),
  mockRegenerate: vi.fn(),
}));

vi.mock("$lib/server/dashboard-authorize", () => ({
  canManageDashboardMembers: mockCanManageDashboardMembers,
}));
vi.mock("$lib/server/dashboards", () => ({
  regenerateDashboardShareToken: mockRegenerate,
}));
vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { POST } from "./+server";

const DASHBOARD_ID = "2f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(userId: string | null, id = DASHBOARD_ID) {
  return {
    params: { id },
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanManageDashboardMembers.mockResolvedValue(true);
});

describe("POST /api/dashboards/[id]/share-token/regenerate", () => {
  it("returns 400 for an invalid dashboard id", async () => {
    await expect(POST(makeEvent("owner", "nope"))).rejects.toMatchObject({
      status: 400,
    });
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated callers", async () => {
    await expect(POST(makeEvent(null))).rejects.toMatchObject({ status: 401 });
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it("returns 404 for non-managers so existence is not revealed", async () => {
    mockCanManageDashboardMembers.mockResolvedValue(false);

    await expect(POST(makeEvent("viewer"))).rejects.toMatchObject({
      status: 404,
    });
    expect(mockCanManageDashboardMembers).toHaveBeenCalledWith(
      "viewer",
      DASHBOARD_ID,
    );
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it("returns the new token and removed follower count for managers", async () => {
    mockRegenerate.mockResolvedValue({
      ok: true,
      shareToken: "new-token",
      removedFollowers: 2,
    });

    const response = await POST(makeEvent("owner"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      shareToken: "new-token",
      removedFollowers: 2,
    });
    expect(mockRegenerate).toHaveBeenCalledWith(DASHBOARD_ID);
  });

  it("returns 400 for dashboards that are not private", async () => {
    mockRegenerate.mockResolvedValue({ ok: false, reason: "not_private" });

    await expect(POST(makeEvent("owner"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 404 when the dashboard disappears", async () => {
    mockRegenerate.mockResolvedValue({ ok: false, reason: "not_found" });

    await expect(POST(makeEvent("owner"))).rejects.toMatchObject({
      status: 404,
    });
  });
});
