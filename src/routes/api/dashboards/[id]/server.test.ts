import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCanEditDashboard,
  mockUpdateDashboard,
  mockEmitDashboardUpdated,
  mockEmitRoomRevoked,
  mockGetDashboard,
  mockCanViewDashboard,
} = vi.hoisted(() => ({
  mockCanEditDashboard: vi.fn(),
  mockUpdateDashboard: vi.fn(),
  mockEmitDashboardUpdated: vi.fn(),
  mockEmitRoomRevoked: vi.fn(),
  mockGetDashboard: vi.fn(),
  mockCanViewDashboard: vi.fn(),
}));

vi.mock("$lib/server/dashboard-authorize", () => ({
  canDeleteDashboard: vi.fn(),
  canEditDashboard: mockCanEditDashboard,
  canViewDashboard: mockCanViewDashboard,
}));

vi.mock("$lib/server/dashboards", () => ({
  deleteDashboard: vi.fn(),
  getDashboard: mockGetDashboard,
  updateDashboard: mockUpdateDashboard,
}));

vi.mock("$lib/utils/socket", () => ({
  emitDashboardUpdated: mockEmitDashboardUpdated,
  emitRoomRevoked: mockEmitRoomRevoked,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { GET, PATCH } from "./+server";

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
    mockUpdateDashboard.mockResolvedValue({
      id: DASHBOARD_ID,
      gridColumns: 3,
      visibilityMode: "public",
      ownerId: "user-1",
      teamId: null,
    });

    const response = await PATCH(makeEvent({ gridColumns: 3 }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ gridColumns: 3 });
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      DASHBOARD_ID,
      expect.objectContaining({ gridColumns: 3 }),
    );
    expect(mockEmitDashboardUpdated).toHaveBeenCalledWith(DASHBOARD_ID, {
      visibilityMode: "public",
      ownerId: "user-1",
      teamId: null,
    });
    expect(mockEmitRoomRevoked).not.toHaveBeenCalled();
  });

  it("revokes socket rooms when the dashboard becomes private", async () => {
    mockUpdateDashboard.mockResolvedValue({
      id: DASHBOARD_ID,
      visibilityMode: "private",
    });

    await PATCH(makeEvent({ visibility: "private" }));

    expect(mockEmitRoomRevoked).toHaveBeenCalledWith("dashboard", DASHBOARD_ID);
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

describe("GET /api/dashboards/[id] share token handling", () => {
  const TOKEN = "dash-secret-token";

  function getEvent(userId: string | null, search = "") {
    return {
      params: { id: DASHBOARD_ID },
      url: new URL(`http://localhost/api/dashboards/${DASHBOARD_ID}${search}`),
      locals: {
        auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
      },
    } as any;
  }

  beforeEach(() => {
    mockGetDashboard.mockResolvedValue({
      id: DASHBOARD_ID,
      title: "Ops",
      visibilityMode: "private",
      shareToken: TOKEN,
    });
    mockCanViewDashboard.mockResolvedValue(true);
  });

  it("omits the token for a token holder", async () => {
    const response = await GET(getEvent(null, `?token=${TOKEN}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty("shareToken");
  });

  it("omits the token for a signed-in viewer", async () => {
    const response = await GET(getEvent("viewer-1"));

    expect(await response.json()).not.toHaveProperty("shareToken");
  });

  it.each([
    ["shorter", "?token=abc"],
    ["longer", `?token=${TOKEN}x`],
    ["empty", "?token="],
  ])("rejects a %s token for anonymous callers", async (_label, search) => {
    await expect(GET(getEvent(null, search))).rejects.toMatchObject({
      status: 403,
    });
  });

  it("rejects any token when the stored token is null", async () => {
    mockGetDashboard.mockResolvedValue({
      id: DASHBOARD_ID,
      visibilityMode: "private",
      shareToken: null,
    });

    await expect(GET(getEvent(null, "?token=null"))).rejects.toMatchObject({
      status: 403,
    });
  });

  it("ignores the token on public dashboards", async () => {
    mockGetDashboard.mockResolvedValue({
      id: DASHBOARD_ID,
      visibilityMode: "public",
      shareToken: "stale",
    });

    const response = await GET(getEvent(null, "?token=stale"));

    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("shareToken");
  });
});

describe("PATCH /api/dashboards/[id] share token", () => {
  it("never returns the share token to editors", async () => {
    mockUpdateDashboard.mockResolvedValue({
      id: DASHBOARD_ID,
      visibilityMode: "private",
      shareToken: "secret",
    });

    const response = await PATCH(makeEvent({ visibility: "private" }));

    expect(await response.json()).not.toHaveProperty("shareToken");
  });
});
