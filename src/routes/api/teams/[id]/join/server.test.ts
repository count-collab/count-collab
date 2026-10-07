import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockJoinTeamByToken, mockEmitTeamMembershipChanged } = vi.hoisted(
  () => ({
    mockJoinTeamByToken: vi.fn(),
    mockEmitTeamMembershipChanged: vi.fn(),
  }),
);

vi.mock("$lib/server/team-members", () => ({
  joinTeamByToken: mockJoinTeamByToken,
}));

vi.mock("$lib/utils/socket", () => ({
  emitTeamMembershipChanged: mockEmitTeamMembershipChanged,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { POST } from "./+server";

const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(userId: string | null, body: unknown, id = TEAM_ID) {
  return {
    params: { id },
    locals: makeLocals(userId),
    request: new Request(`http://localhost/api/teams/${id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/teams/[id]/join", () => {
  it("returns 400 for an invalid id", async () => {
    await expect(
      POST(makeEvent("user-1", { token: "t" }, "nope")),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(POST(makeEvent(null, { token: "t" }))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 400 without a token", async () => {
    const response = await POST(makeEvent("user-1", {}));
    expect(response.status).toBe(400);
    expect(mockJoinTeamByToken).not.toHaveBeenCalled();
  });

  it("passes through failures", async () => {
    mockJoinTeamByToken.mockResolvedValue({
      ok: false,
      status: 404,
      message: "Invalid join link",
    });

    const response = await POST(makeEvent("user-1", { token: "bad" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Invalid join link" });
    expect(mockEmitTeamMembershipChanged).not.toHaveBeenCalled();
  });

  it("notifies the joining user", async () => {
    mockJoinTeamByToken.mockResolvedValue({
      ok: true,
      member: { role: "viewer" },
      alreadyMember: false,
    });

    const response = await POST(makeEvent("user-1", { token: "good" }));

    expect(await response.json()).toEqual({ alreadyMember: false });
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(["user-1"], {
      teamId: TEAM_ID,
      reason: "joined",
    });
  });

  it("returns alreadyMember", async () => {
    mockJoinTeamByToken.mockResolvedValue({
      ok: true,
      member: { role: "viewer" },
      alreadyMember: true,
    });

    const response = await POST(makeEvent("user-1", { token: "good" }));

    expect(await response.json()).toEqual({ alreadyMember: true });
    expect(mockJoinTeamByToken).toHaveBeenCalledWith(TEAM_ID, "user-1", "good");
    expect(mockEmitTeamMembershipChanged).not.toHaveBeenCalled();
  });
});
