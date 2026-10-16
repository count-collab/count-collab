import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCanViewTeam,
  mockCanManageTeam,
  mockGetActingTeamRole,
  mockGetTeamInvitations,
  mockUpdateTeamInvitationRole,
  mockDeleteTeamInvitation,
  mockEmitInvitationUpdated,
  mockEmitInvitationDeleted,
} = vi.hoisted(() => ({
  mockCanViewTeam: vi.fn(),
  mockCanManageTeam: vi.fn(),
  mockGetActingTeamRole: vi.fn(),
  mockGetTeamInvitations: vi.fn(),
  mockUpdateTeamInvitationRole: vi.fn(),
  mockDeleteTeamInvitation: vi.fn(),
  mockEmitInvitationUpdated: vi.fn(),
  mockEmitInvitationDeleted: vi.fn(),
}));

vi.mock("$lib/server/team-authorize", () => ({
  canViewTeam: mockCanViewTeam,
  canManageTeam: mockCanManageTeam,
  getActingTeamRole: mockGetActingTeamRole,
}));

vi.mock("$lib/server/invitations", () => ({
  getTeamInvitations: mockGetTeamInvitations,
  updateTeamInvitationRole: mockUpdateTeamInvitationRole,
  deleteTeamInvitation: mockDeleteTeamInvitation,
}));

vi.mock("$lib/utils/socket", () => ({
  emitInvitationUpdated: mockEmitInvitationUpdated,
  emitInvitationDeleted: mockEmitInvitationDeleted,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { DELETE, PATCH } from "./+server";

const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(
  targetUserId: string,
  userId: string | null,
  body?: unknown,
) {
  return {
    params: { id: TEAM_ID, userId: targetUserId },
    locals: makeLocals(userId),
    request: new Request(
      `http://localhost/t/${TEAM_ID}/invitations/${targetUserId}`,
      {
        method: body === undefined ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    ),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanViewTeam.mockResolvedValue(true);
  mockCanManageTeam.mockResolvedValue(true);
  mockGetActingTeamRole.mockResolvedValue("admin");
  mockGetTeamInvitations.mockResolvedValue([
    { userId: "user-2", role: "viewer" },
    { userId: "user-3", role: "owner" },
  ]);
  mockUpdateTeamInvitationRole.mockResolvedValue({
    userId: "user-2",
    role: "editor",
  });
  mockDeleteTeamInvitation.mockResolvedValue(true);
});

describe("PATCH /t/[id]/invitations/[userId]", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(
      PATCH(makeEvent("user-2", null, { role: "editor" })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns 404 for non-members", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    mockCanViewTeam.mockResolvedValue(false);
    await expect(
      PATCH(makeEvent("user-2", "user-1", { role: "editor" })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns 403 for members who cannot manage", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    await expect(
      PATCH(makeEvent("user-2", "user-1", { role: "editor" })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns 403 when an admin tries to grant owner", async () => {
    await expect(
      PATCH(makeEvent("user-2", "user-1", { role: "owner" })),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockUpdateTeamInvitationRole).not.toHaveBeenCalled();
  });

  it("returns 404 when there is no invitation", async () => {
    await expect(
      PATCH(makeEvent("user-9", "user-1", { role: "editor" })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("updates the role and emits", async () => {
    const response = await PATCH(
      makeEvent("user-2", "user-1", { role: "editor" }),
    );
    expect(response.status).toBe(200);
    expect(mockEmitInvitationUpdated).toHaveBeenCalledWith("user-2");
  });
});

describe("DELETE /t/[id]/invitations/[userId]", () => {
  it("returns 403 when an admin cancels an owner invitation", async () => {
    await expect(DELETE(makeEvent("user-3", "user-1"))).rejects.toMatchObject({
      status: 403,
    });
    expect(mockDeleteTeamInvitation).not.toHaveBeenCalled();
  });

  it("cancels the invitation and emits", async () => {
    const response = await DELETE(makeEvent("user-2", "user-1"));
    expect(response.status).toBe(200);
    expect(mockDeleteTeamInvitation).toHaveBeenCalledWith(TEAM_ID, "user-2");
    expect(mockEmitInvitationDeleted).toHaveBeenCalledWith("user-2");
  });
});
