import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAcceptTeamInvitation,
  mockDeleteTeamInvitation,
  mockEmitInvitationDeleted,
  mockEmitTeamMembershipChanged,
} = vi.hoisted(() => ({
  mockAcceptTeamInvitation: vi.fn(),
  mockDeleteTeamInvitation: vi.fn(),
  mockEmitInvitationDeleted: vi.fn(),
  mockEmitTeamMembershipChanged: vi.fn(),
}));

vi.mock("$lib/server/invitations", () => ({
  acceptTeamInvitation: mockAcceptTeamInvitation,
  deleteTeamInvitation: mockDeleteTeamInvitation,
}));

vi.mock("$lib/utils/socket", () => ({
  emitInvitationDeleted: mockEmitInvitationDeleted,
  emitTeamMembershipChanged: mockEmitTeamMembershipChanged,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { DELETE, POST } from "./+server";

const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(userId: string | null, teamId = TEAM_ID) {
  return {
    params: { teamId },
    locals: {
      auth: vi.fn(async () =>
        userId ? { user: { id: userId } } : { user: null },
      ),
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/invitations/team/[teamId]", () => {
  it("returns 400 for an invalid id", async () => {
    await expect(POST(makeEvent("user-1", "nope"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(POST(makeEvent(null))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 404 without an invitation", async () => {
    mockAcceptTeamInvitation.mockResolvedValue(null);
    await expect(POST(makeEvent("user-1"))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("accepts the invitation", async () => {
    mockAcceptTeamInvitation.mockResolvedValue({ role: "editor" });

    const response = await POST(makeEvent("user-1"));

    expect(response.status).toBe(201);
    expect(mockAcceptTeamInvitation).toHaveBeenCalledWith(TEAM_ID, "user-1");
    expect(mockEmitInvitationDeleted).toHaveBeenCalledWith("user-1");
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(["user-1"], {
      teamId: TEAM_ID,
      reason: "joined",
    });
  });
});

describe("DELETE /api/invitations/team/[teamId]", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(DELETE(makeEvent(null))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 404 without an invitation", async () => {
    mockDeleteTeamInvitation.mockResolvedValue(false);
    await expect(DELETE(makeEvent("user-1"))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("declines the invitation", async () => {
    mockDeleteTeamInvitation.mockResolvedValue(true);

    const response = await DELETE(makeEvent("user-1"));

    expect(await response.json()).toEqual({ success: true });
    expect(mockDeleteTeamInvitation).toHaveBeenCalledWith(TEAM_ID, "user-1");
  });
});
