import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCanEditDashboard,
  mockGetDashboard,
  mockGetDashboardItem,
  mockAddDashboardItem,
  mockRelayoutDashboardItems,
} = vi.hoisted(() => ({
  mockCanEditDashboard: vi.fn(),
  mockGetDashboard: vi.fn(),
  mockGetDashboardItem: vi.fn(),
  mockAddDashboardItem: vi.fn(),
  mockRelayoutDashboardItems: vi.fn(),
}));

vi.mock("$lib/server/dashboard-authorize", () => ({
  canEditDashboard: mockCanEditDashboard,
}));

vi.mock("$lib/server/dashboards", () => ({
  getDashboard: mockGetDashboard,
}));

vi.mock("$lib/server/dashboard-items", () => ({
  addDashboardItem: mockAddDashboardItem,
  getDashboardItem: mockGetDashboardItem,
  relayoutDashboardItems: mockRelayoutDashboardItems,
  removeDashboardItem: vi.fn(),
}));

vi.mock("$lib/utils/socket", () => ({
  emitDashboardItemAdded: vi.fn(),
  emitDashboardItemRemoved: vi.fn(),
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { PATCH, POST } from "./+server";

const DASHBOARD_ID = "2f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const COUNTER_ID = "1f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(method: string, body: unknown) {
  return {
    params: { id: DASHBOARD_ID },
    locals: { auth: vi.fn(async () => ({ user: { id: "user-1" } })) },
    request: new Request(`http://localhost/api/dashboards/${DASHBOARD_ID}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanEditDashboard.mockResolvedValue(true);
  mockGetDashboard.mockResolvedValue({ id: DASHBOARD_ID, gridColumns: 3 });
  mockRelayoutDashboardItems.mockResolvedValue([]);
});

describe("POST /api/dashboards/[id]/items", () => {
  it("rejects an item that exceeds the dashboard's columns", async () => {
    const response = await POST(
      makeEvent("POST", {
        counterId: COUNTER_ID,
        positionX: 2,
        positionY: 0,
        sizeColumns: 2,
      }),
    );
    expect(response.status).toBe(400);
    expect(mockAddDashboardItem).not.toHaveBeenCalled();
  });

  it("adds an item that fits", async () => {
    mockAddDashboardItem.mockResolvedValue({ id: 7 });
    const response = await POST(
      makeEvent("POST", {
        counterId: COUNTER_ID,
        positionX: 1,
        positionY: 0,
        sizeColumns: 2,
      }),
    );
    expect(response.status).toBe(201);
    expect(mockAddDashboardItem).toHaveBeenCalledWith(
      DASHBOARD_ID,
      COUNTER_ID,
      1,
      0,
      2,
      1,
    );
  });

  it("returns 404 when the dashboard does not exist", async () => {
    mockGetDashboard.mockResolvedValue(null);
    await expect(
      POST(
        makeEvent("POST", {
          counterId: COUNTER_ID,
          positionX: 0,
          positionY: 0,
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("PATCH /api/dashboards/[id]/items", () => {
  it("rejects a move that pushes the item past the dashboard's columns", async () => {
    mockGetDashboardItem.mockResolvedValue({ id: 1, sizeColumns: 2 });
    const response = await PATCH(
      makeEvent("PATCH", {
        action: "move",
        itemId: 1,
        positionX: 2,
        positionY: 0,
      }),
    );
    expect(response.status).toBe(400);
    expect(mockRelayoutDashboardItems).not.toHaveBeenCalled();
  });

  it("returns 404 when moving an item not on the dashboard", async () => {
    mockGetDashboardItem.mockResolvedValue(null);
    await expect(
      PATCH(
        makeEvent("PATCH", {
          action: "move",
          itemId: 99,
          positionX: 0,
          positionY: 0,
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("passes gridColumns to relayout for a valid move", async () => {
    mockGetDashboardItem.mockResolvedValue({ id: 1, sizeColumns: 1 });
    const response = await PATCH(
      makeEvent("PATCH", {
        action: "move",
        itemId: 1,
        positionX: 2,
        positionY: 1,
      }),
    );
    expect(response.status).toBe(200);
    expect(mockRelayoutDashboardItems).toHaveBeenCalledWith(
      DASHBOARD_ID,
      { type: "move", itemId: 1, positionX: 2, positionY: 1 },
      3,
    );
  });

  it("rejects a resize wider than the dashboard's columns", async () => {
    const response = await PATCH(
      makeEvent("PATCH", {
        action: "resize",
        itemId: 1,
        sizeColumns: 4,
        sizeRows: 1,
      }),
    );
    expect(response.status).toBe(400);
    expect(mockRelayoutDashboardItems).not.toHaveBeenCalled();
  });

  it("passes gridColumns to relayout for a valid resize", async () => {
    const response = await PATCH(
      makeEvent("PATCH", {
        action: "resize",
        itemId: 1,
        sizeColumns: 3,
        sizeRows: 2,
      }),
    );
    expect(response.status).toBe(200);
    expect(mockRelayoutDashboardItems).toHaveBeenCalledWith(
      DASHBOARD_ID,
      { type: "resize", itemId: 1, sizeColumns: 3, sizeRows: 2 },
      3,
    );
  });
});
