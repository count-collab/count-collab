import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTransferCounter } = vi.hoisted(() => ({
  mockTransferCounter: vi.fn(),
}));

vi.mock("$lib/server/transfer", () => ({
  transferCounter: mockTransferCounter,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { POST } from "./+server";

const COUNTER_ID = "1f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(userId: string | null, body: unknown, id = COUNTER_ID) {
  return {
    params: { id },
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
    request: new Request(`http://localhost/api/counters/${id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/counters/[id]/transfer", () => {
  it("returns 400 for an invalid id", async () => {
    await expect(
      POST(makeEvent("user-1", { teamId: TEAM_ID }, "nope")),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(
      POST(makeEvent(null, { teamId: TEAM_ID })),
    ).rejects.toMatchObject({ status: 401 });
    expect(mockTransferCounter).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const response = await POST(makeEvent("user-1", { teamId: "bad" }));
    expect(response.status).toBe(400);
    expect(mockTransferCounter).not.toHaveBeenCalled();
  });

  it("maps transfer failures to HTTP errors", async () => {
    mockTransferCounter.mockResolvedValue({
      ok: false,
      status: 403,
      message: "Editor role required in the target team",
    });

    await expect(
      POST(makeEvent("user-1", { teamId: TEAM_ID })),
    ).rejects.toMatchObject({
      status: 403,
      body: { message: "Editor role required in the target team" },
    });
  });

  it("transfers to a team and ignores counterIds", async () => {
    mockTransferCounter.mockResolvedValue({ ok: true });

    const response = await POST(
      makeEvent("user-1", { teamId: TEAM_ID, counterIds: [COUNTER_ID] }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockTransferCounter).toHaveBeenCalledWith(
      "user-1",
      COUNTER_ID,
      TEAM_ID,
    );
  });

  it("transfers back to personal ownership with teamId null", async () => {
    mockTransferCounter.mockResolvedValue({ ok: true });

    await POST(makeEvent("user-1", { teamId: null }));

    expect(mockTransferCounter).toHaveBeenCalledWith(
      "user-1",
      COUNTER_ID,
      null,
    );
  });
});
