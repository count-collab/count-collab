import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateDashboard,
  mockEmitDashboardCreated,
  mockCanEditTeamResources,
} = vi.hoisted(() => ({
  mockCreateDashboard: vi.fn(),
  mockEmitDashboardCreated: vi.fn(),
  mockCanEditTeamResources: vi.fn(),
}));

vi.mock("$lib/server/dashboards", () => ({
  createDashboard: mockCreateDashboard,
}));

vi.mock("$lib/server/team-authorize", () => ({
  canEditTeamResources: mockCanEditTeamResources,
}));

vi.mock("$lib/utils/socket", () => ({
  emitDashboardCreated: mockEmitDashboardCreated,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { POST } from "./+server";

const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(userId: string | null, body: unknown) {
  return {
    request: new Request("http://localhost/api/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/dashboards", () => {
  it("returns 401 for anonymous users", async () => {
    const response = await POST(makeEvent(null, { title: "Board" }));
    expect(response.status).toBe(401);
    expect(mockCreateDashboard).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid teamId", async () => {
    const response = await POST(
      makeEvent("user-1", { title: "Board", teamId: "nope" }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 403 when the user cannot edit team resources", async () => {
    mockCanEditTeamResources.mockResolvedValue(false);

    await expect(
      POST(makeEvent("user-1", { title: "Board", teamId: TEAM_ID })),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockCreateDashboard).not.toHaveBeenCalled();
  });

  it("creates the dashboard in the team", async () => {
    mockCanEditTeamResources.mockResolvedValue(true);
    mockCreateDashboard.mockResolvedValue({ id: "d-1" });

    const response = await POST(
      makeEvent("user-1", { title: "Board", teamId: TEAM_ID }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "user-1", teamId: TEAM_ID }),
    );
    expect(mockEmitDashboardCreated).toHaveBeenCalledWith("d-1");
  });

  it("creates personal dashboards without a team check", async () => {
    mockCreateDashboard.mockResolvedValue({ id: "d-2" });

    await POST(makeEvent("user-1", { title: "Board" }));

    expect(mockCanEditTeamResources).not.toHaveBeenCalled();
    expect(mockCreateDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "user-1", teamId: null }),
    );
  });
});
