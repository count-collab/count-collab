import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCanEditDashboard,
  mockGetDashboard,
  mockGetDashboardItem,
  mockAddDashboardItem,
  mockRelayoutDashboardItems,
  mockRemoveDashboardItem,
  mockEmitDashboardItemRemoved,
  mockGetCounter,
  mockCanViewPrivateCounter,
} = vi.hoisted(() => ({
  mockCanEditDashboard: vi.fn(),
  mockGetDashboard: vi.fn(),
  mockGetDashboardItem: vi.fn(),
  mockAddDashboardItem: vi.fn(),
  mockRelayoutDashboardItems: vi.fn(),
  mockRemoveDashboardItem: vi.fn(),
  mockEmitDashboardItemRemoved: vi.fn(),
  mockGetCounter: vi.fn(),
  mockCanViewPrivateCounter: vi.fn(),
}));

vi.mock("$lib/server/authorize", () => ({
  canViewPrivateCounter: mockCanViewPrivateCounter,
}));

vi.mock("$lib/server/counters", () => ({ getCounter: mockGetCounter }));

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
  removeDashboardItem: mockRemoveDashboardItem,
}));

vi.mock("$lib/utils/socket", () => ({
  emitDashboardItemAdded: vi.fn(),
  emitDashboardItemRemoved: mockEmitDashboardItemRemoved,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { DELETE, PATCH, POST } from "./+server";

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
  mockGetCounter.mockResolvedValue({
    id: COUNTER_ID,
    visibilityMode: "public",
  });
  mockCanViewPrivateCounter.mockResolvedValue(true);
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

  it("returns 404 when the counter does not exist", async () => {
    mockGetCounter.mockResolvedValue(null);
    await expect(
      POST(
        makeEvent("POST", { counterId: COUNTER_ID, positionX: 0, positionY: 0 }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockAddDashboardItem).not.toHaveBeenCalled();
  });

  it("returns 404 for a private counter the actor cannot view", async () => {
    mockGetCounter.mockResolvedValue({
      id: COUNTER_ID,
      visibilityMode: "private",
    });
    mockCanViewPrivateCounter.mockResolvedValue(false);
    await expect(
      POST(
        makeEvent("POST", { counterId: COUNTER_ID, positionX: 0, positionY: 0 }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockCanViewPrivateCounter).toHaveBeenCalledWith(
      "user-1",
      COUNTER_ID,
    );
    expect(mockAddDashboardItem).not.toHaveBeenCalled();
  });

  it("allows a private counter the actor can view", async () => {
    mockGetCounter.mockResolvedValue({
      id: COUNTER_ID,
      visibilityMode: "private",
    });
    mockAddDashboardItem.mockResolvedValue({ id: 8 });
    const response = await POST(
      makeEvent("POST", { counterId: COUNTER_ID, positionX: 0, positionY: 0 }),
    );
    expect(response.status).toBe(201);
  });

  it("returns 409 when the dashboard item limit is reached", async () => {
    mockAddDashboardItem.mockResolvedValue(null);
    await expect(
      POST(
        makeEvent("POST", { counterId: COUNTER_ID, positionX: 0, positionY: 0 }),
      ),
    ).rejects.toMatchObject({ status: 409 });
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
    mockGetDashboardItem.mockResolvedValue({ id: 1, sizeColumns: 1 });
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

  it("returns 404 when resizing an item not on the dashboard", async () => {
    mockGetDashboardItem.mockResolvedValue(null);
    await expect(
      PATCH(
        makeEvent("PATCH", {
          action: "resize",
          itemId: 99,
          sizeColumns: 1,
          sizeRows: 1,
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockRelayoutDashboardItems).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/dashboards/[id]/items", () => {
  it("scopes the removal to the dashboard and emits with its id", async () => {
    mockRemoveDashboardItem.mockResolvedValue(true);
    const response = await DELETE(makeEvent("DELETE", { itemId: 5 }));
    expect(response.status).toBe(200);
    expect(mockRemoveDashboardItem).toHaveBeenCalledWith(DASHBOARD_ID, 5);
    expect(mockEmitDashboardItemRemoved).toHaveBeenCalledWith(DASHBOARD_ID, 5);
  });

  it("returns 404 and emits nothing when no row matched", async () => {
    mockRemoveDashboardItem.mockResolvedValue(false);
    await expect(
      DELETE(makeEvent("DELETE", { itemId: 5 })),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockEmitDashboardItemRemoved).not.toHaveBeenCalled();
  });
});
