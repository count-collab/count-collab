import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCanViewTeam,
  mockGetActingTeamRole,
  mockGetUserTeamRole,
  mockUpdateTeamMemberRole,
  mockRemoveTeamMember,
  mockEmitTeamMembershipChanged,
} = vi.hoisted(() => ({
  mockCanViewTeam: vi.fn(),
  mockGetActingTeamRole: vi.fn(),
  mockGetUserTeamRole: vi.fn(),
  mockUpdateTeamMemberRole: vi.fn(),
  mockRemoveTeamMember: vi.fn(),
  mockEmitTeamMembershipChanged: vi.fn(),
}));

vi.mock("$lib/server/team-authorize", () => ({
  canViewTeam: mockCanViewTeam,
  getActingTeamRole: mockGetActingTeamRole,
  getUserTeamRole: mockGetUserTeamRole,
}));

vi.mock("$lib/server/team-members", () => ({
  updateTeamMemberRole: mockUpdateTeamMemberRole,
  removeTeamMember: mockRemoveTeamMember,
}));

vi.mock("$lib/utils/socket", () => ({
  emitTeamMembershipChanged: mockEmitTeamMembershipChanged,
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
  id = TEAM_ID,
) {
  return {
    params: { id, userId: targetUserId },
    locals: makeLocals(userId),
    request: new Request(`http://localhost/t/${id}/members/${targetUserId}`, {
      method: body === undefined ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanViewTeam.mockResolvedValue(true);
  mockGetActingTeamRole.mockResolvedValue("admin");
  mockGetUserTeamRole.mockResolvedValue("viewer");
  mockUpdateTeamMemberRole.mockResolvedValue({
    ok: true,
    member: { userId: "user-2", role: "editor" },
  });
  mockRemoveTeamMember.mockResolvedValue({ ok: true });
});

describe("PATCH /t/[id]/members/[userId]", () => {
  it("returns 400 for an invalid team id", async () => {
    await expect(
      PATCH(makeEvent("user-2", "user-1", { role: "editor" }, "nope")),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(
      PATCH(makeEvent("user-2", null, { role: "editor" })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns 404 for non-members", async () => {
    mockCanViewTeam.mockResolvedValue(false);
    await expect(
      PATCH(makeEvent("user-2", "user-1", { role: "editor" })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns 403 when an admin tries to grant owner", async () => {
    await expect(
      PATCH(makeEvent("user-2", "user-1", { role: "owner" })),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockUpdateTeamMemberRole).not.toHaveBeenCalled();
  });

  it("returns 403 for members below admin", async () => {
    mockGetActingTeamRole.mockResolvedValue("editor");
    await expect(
      PATCH(makeEvent("user-2", "user-1", { role: "viewer" })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("updates the role", async () => {
    const response = await PATCH(
      makeEvent("user-2", "user-1", { role: "editor" }),
    );
    expect(response.status).toBe(200);
    expect(mockUpdateTeamMemberRole).toHaveBeenCalledWith(
      TEAM_ID,
      "user-2",
      "editor",
      { userId: "user-1", actingRole: "admin" },
    );
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(["user-2"], {
      teamId: TEAM_ID,
      reason: "role_changed",
    });
  });

  it("passes through the 403 from the locked re-check", async () => {
    mockUpdateTeamMemberRole.mockResolvedValue({
      ok: false,
      status: 403,
      message: "You don't have permission to change this member",
    });

    const response = await PATCH(
      makeEvent("user-2", "user-1", { role: "editor" }),
    );

    expect(response.status).toBe(403);
    expect(mockEmitTeamMembershipChanged).not.toHaveBeenCalled();
  });

  it("passes through the last-owner 409", async () => {
    mockGetActingTeamRole.mockResolvedValue("owner");
    mockGetUserTeamRole.mockResolvedValue("owner");
    mockUpdateTeamMemberRole.mockResolvedValue({
      ok: false,
      status: 409,
      message: "A team must have at least one owner",
    });

    const response = await PATCH(
      makeEvent("user-1", "user-1", { role: "admin" }),
    );

    expect(response.status).toBe(409);
    expect(mockEmitTeamMembershipChanged).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: "A team must have at least one owner",
    });
  });
});

describe("DELETE /t/[id]/members/[userId]", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(DELETE(makeEvent("user-2", null))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("lets any member leave", async () => {
    mockGetActingTeamRole.mockResolvedValue("viewer");

    const response = await DELETE(makeEvent("user-1", "user-1"));

    expect(response.status).toBe(200);
    expect(mockRemoveTeamMember).toHaveBeenCalledWith(
      TEAM_ID,
      "user-1",
      undefined,
    );
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(["user-1"], {
      teamId: TEAM_ID,
      reason: "removed",
    });
  });

  it("passes through the 409 when the last owner leaves", async () => {
    mockRemoveTeamMember.mockResolvedValue({
      ok: false,
      status: 409,
      message: "A team must have at least one owner",
    });

    const response = await DELETE(makeEvent("user-1", "user-1"));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "A team must have at least one owner",
    });
  });

  it("returns 404 when a non-member removes someone", async () => {
    mockCanViewTeam.mockResolvedValue(false);
    await expect(DELETE(makeEvent("user-2", "user-1"))).rejects.toMatchObject({
      status: 404,
    });
    expect(mockRemoveTeamMember).not.toHaveBeenCalled();
  });

  it("returns 403 when an admin removes an owner", async () => {
    mockGetUserTeamRole.mockResolvedValue("owner");
    await expect(DELETE(makeEvent("user-2", "user-1"))).rejects.toMatchObject({
      status: 403,
    });
    expect(mockRemoveTeamMember).not.toHaveBeenCalled();
  });

  it("lets an admin remove a viewer", async () => {
    const response = await DELETE(makeEvent("user-2", "user-1"));
    expect(response.status).toBe(200);
    expect(mockRemoveTeamMember).toHaveBeenCalledWith(TEAM_ID, "user-2", {
      userId: "user-1",
      actingRole: "admin",
    });
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(["user-2"], {
      teamId: TEAM_ID,
      reason: "removed",
    });
  });
});
