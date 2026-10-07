import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTransferDashboard, mockEmitDashboardUpdated } = vi.hoisted(() => ({
  mockTransferDashboard: vi.fn(),
  mockEmitDashboardUpdated: vi.fn(),
}));

vi.mock("$lib/server/transfer", () => ({
  transferDashboard: mockTransferDashboard,
}));

vi.mock("$lib/utils/socket", () => ({
  emitDashboardUpdated: mockEmitDashboardUpdated,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { POST } from "./+server";

const DASHBOARD_ID = "2f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const COUNTER_ID = "1f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(userId: string | null, body: unknown, id = DASHBOARD_ID) {
  return {
    params: { id },
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
    request: new Request(`http://localhost/api/dashboards/${id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/dashboards/[id]/transfer", () => {
  it("returns 400 for an invalid id", async () => {
    await expect(
      POST(makeEvent("user-1", { teamId: TEAM_ID }, "nope")),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(
      POST(makeEvent(null, { teamId: TEAM_ID })),
    ).rejects.toMatchObject({ status: 401 });
    expect(mockTransferDashboard).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid counter ids", async () => {
    const response = await POST(
      makeEvent("user-1", { teamId: TEAM_ID, counterIds: ["bad"] }),
    );
    expect(response.status).toBe(400);
    expect(mockTransferDashboard).not.toHaveBeenCalled();
  });

  it("maps transfer failures to HTTP errors and does not emit", async () => {
    mockTransferDashboard.mockResolvedValue({
      ok: false,
      status: 404,
      message: "Team not found",
    });

    await expect(
      POST(makeEvent("user-1", { teamId: TEAM_ID })),
    ).rejects.toMatchObject({
      status: 404,
      body: { message: "Team not found" },
    });
    expect(mockEmitDashboardUpdated).not.toHaveBeenCalled();
  });

  it("transfers with counterIds and emits a dashboard update", async () => {
    mockTransferDashboard.mockResolvedValue({ ok: true });

    const response = await POST(
      makeEvent("user-1", { teamId: TEAM_ID, counterIds: [COUNTER_ID] }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockTransferDashboard).toHaveBeenCalledWith(
      "user-1",
      DASHBOARD_ID,
      TEAM_ID,
      [COUNTER_ID],
    );
    expect(mockEmitDashboardUpdated).toHaveBeenCalledWith(DASHBOARD_ID);
  });

  it("defaults counterIds to an empty array", async () => {
    mockTransferDashboard.mockResolvedValue({ ok: true });

    await POST(makeEvent("user-1", { teamId: null }));

    expect(mockTransferDashboard).toHaveBeenCalledWith(
      "user-1",
      DASHBOARD_ID,
      null,
      [],
    );
  });
});
