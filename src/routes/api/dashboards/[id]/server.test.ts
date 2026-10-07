import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCanEditDashboard, mockUpdateDashboard, mockEmitDashboardUpdated } =
  vi.hoisted(() => ({
    mockCanEditDashboard: vi.fn(),
    mockUpdateDashboard: vi.fn(),
    mockEmitDashboardUpdated: vi.fn(),
  }));

vi.mock("$lib/server/dashboard-authorize", () => ({
  canDeleteDashboard: vi.fn(),
  canEditDashboard: mockCanEditDashboard,
  canViewDashboard: vi.fn(),
}));

vi.mock("$lib/server/dashboards", () => ({
  deleteDashboard: vi.fn(),
  getDashboard: vi.fn(),
  updateDashboard: mockUpdateDashboard,
}));

vi.mock("$lib/utils/socket", () => ({
  emitDashboardUpdated: mockEmitDashboardUpdated,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { PATCH } from "./+server";

const DASHBOARD_ID = "2f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(body: unknown) {
  return {
    params: { id: DASHBOARD_ID },
    locals: { auth: vi.fn(async () => ({ user: { id: "user-1" } })) },
    request: new Request(`http://localhost/api/dashboards/${DASHBOARD_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanEditDashboard.mockResolvedValue(true);
});

describe("PATCH /api/dashboards/[id] gridColumns", () => {
  it("passes gridColumns through and returns the updated dashboard", async () => {
    mockUpdateDashboard.mockResolvedValue({ id: DASHBOARD_ID, gridColumns: 3 });

    const response = await PATCH(makeEvent({ gridColumns: 3 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ gridColumns: 3 });
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      DASHBOARD_ID,
      expect.objectContaining({ gridColumns: 3 }),
    );
    expect(mockEmitDashboardUpdated).toHaveBeenCalledWith(DASHBOARD_ID);
  });

  it.each([1, 6, 2.5])("rejects gridColumns=%s", async (gridColumns) => {
    const response = await PATCH(makeEvent({ gridColumns }));
    expect(response.status).toBe(400);
    expect(mockUpdateDashboard).not.toHaveBeenCalled();
  });

  it("omits gridColumns when not provided", async () => {
    mockUpdateDashboard.mockResolvedValue({ id: DASHBOARD_ID });

    await PATCH(makeEvent({ title: "Renamed" }));

    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      DASHBOARD_ID,
      expect.objectContaining({ title: "Renamed", gridColumns: undefined }),
    );
  });
});
