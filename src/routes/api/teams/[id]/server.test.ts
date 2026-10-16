import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCanViewTeam,
  mockCanManageTeam,
  mockCanDeleteTeam,
  mockGetUserTeamRole,
  mockGetTeam,
  mockUpdateTeam,
  mockDeleteTeam,
  mockGetTeamMembers,
  mockEmitTeamMembershipChanged,
} = vi.hoisted(() => ({
  mockCanViewTeam: vi.fn(),
  mockCanManageTeam: vi.fn(),
  mockCanDeleteTeam: vi.fn(),
  mockGetUserTeamRole: vi.fn(),
  mockGetTeam: vi.fn(),
  mockUpdateTeam: vi.fn(),
  mockDeleteTeam: vi.fn(),
  mockGetTeamMembers: vi.fn(),
  mockEmitTeamMembershipChanged: vi.fn(),
}));

vi.mock("$lib/server/team-authorize", () => ({
  canViewTeam: mockCanViewTeam,
  canManageTeam: mockCanManageTeam,
  canDeleteTeam: mockCanDeleteTeam,
  getUserTeamRole: mockGetUserTeamRole,
}));

vi.mock("$lib/server/teams", () => ({
  getTeam: mockGetTeam,
  updateTeam: mockUpdateTeam,
  deleteTeam: mockDeleteTeam,
}));

vi.mock("$lib/server/team-members", () => ({
  getTeamMembers: mockGetTeamMembers,
}));

vi.mock("$lib/utils/socket", () => ({
  emitTeamMembershipChanged: mockEmitTeamMembershipChanged,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { DELETE, GET, PATCH } from "./+server";

const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const TEAM = { id: TEAM_ID, name: "Core Team", joinToken: "secret" };

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(
  id: string,
  userId: string | null,
  body?: unknown,
  method = "GET",
) {
  return {
    params: { id },
    locals: makeLocals(userId),
    request: new Request(`http://localhost/api/teams/${id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanViewTeam.mockResolvedValue(true);
  mockCanManageTeam.mockResolvedValue(true);
  mockCanDeleteTeam.mockResolvedValue(true);
  mockGetUserTeamRole.mockResolvedValue("owner");
  mockGetTeam.mockResolvedValue(TEAM);
  mockGetTeamMembers.mockResolvedValue([
    { userId: "user-1" },
    { userId: "user-2" },
  ]);
});

describe("GET /api/teams/[id]", () => {
  it("returns 400 for an invalid id", async () => {
    await expect(GET(makeEvent("nope", "user-1"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(GET(makeEvent(TEAM_ID, null))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 404 for non-members", async () => {
    mockCanViewTeam.mockResolvedValue(false);
    await expect(GET(makeEvent(TEAM_ID, "user-1"))).rejects.toMatchObject({
      status: 404,
    });
    expect(mockGetTeam).not.toHaveBeenCalled();
  });

  it("returns 404 when the team no longer exists", async () => {
    mockGetTeam.mockResolvedValue(null);
    await expect(GET(makeEvent(TEAM_ID, "user-1"))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns the team with the caller's role", async () => {
    const response = await GET(makeEvent(TEAM_ID, "user-1"));
    expect(await response.json()).toEqual({ team: TEAM, role: "owner" });
  });

  it("hides the join token from non-managers", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    mockGetUserTeamRole.mockResolvedValue("viewer");

    const response = await GET(makeEvent(TEAM_ID, "user-1"));
    const body = await response.json();

    expect(body.team.joinToken).toBeNull();
    expect(body.role).toBe("viewer");
  });
});

describe("PATCH /api/teams/[id]", () => {
  it("returns 400 for an invalid id", async () => {
    await expect(
      PATCH(makeEvent("nope", "user-1", { name: "X" }, "PATCH")),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(
      PATCH(makeEvent(TEAM_ID, null, { name: "X" }, "PATCH")),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns 400 for an invalid body without updating", async () => {
    const response = await PATCH(
      makeEvent(TEAM_ID, "user-1", { name: "" }, "PATCH"),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTeam).not.toHaveBeenCalled();
  });
  it("returns 404 for non-members", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    mockCanViewTeam.mockResolvedValue(false);
    await expect(
      PATCH(makeEvent(TEAM_ID, "user-1", { name: "X" }, "PATCH")),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns 403 for members who cannot manage", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    await expect(
      PATCH(makeEvent(TEAM_ID, "user-1", { name: "X" }, "PATCH")),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockUpdateTeam).not.toHaveBeenCalled();
    expect(mockEmitTeamMembershipChanged).not.toHaveBeenCalled();
  });

  it("updates the name without touching the description", async () => {
    mockUpdateTeam.mockResolvedValue({ ...TEAM, name: "New" });

    const response = await PATCH(
      makeEvent(TEAM_ID, "user-1", { name: "New" }, "PATCH"),
    );

    expect(response.status).toBe(200);
    expect(mockUpdateTeam).toHaveBeenCalledWith(TEAM_ID, { name: "New" });
  });

  it("returns 404 when the team disappears before the update", async () => {
    mockUpdateTeam.mockResolvedValue(null);

    await expect(
      PATCH(makeEvent(TEAM_ID, "user-1", { name: "New" }, "PATCH")),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockEmitTeamMembershipChanged).not.toHaveBeenCalled();
  });

  it("notifies all members after an update", async () => {
    mockUpdateTeam.mockResolvedValue({ ...TEAM, name: "New" });

    await PATCH(makeEvent(TEAM_ID, "user-1", { name: "New" }, "PATCH"));

    expect(mockGetTeamMembers).toHaveBeenCalledWith(TEAM_ID);
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(
      ["user-1", "user-2"],
      { teamId: TEAM_ID, reason: "team_updated" },
    );
  });
});

describe("DELETE /api/teams/[id]", () => {
  it("returns 400 for an invalid id", async () => {
    await expect(
      DELETE(
        makeEvent("nope", "user-1", { confirmName: "Core Team" }, "DELETE"),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockCanDeleteTeam).not.toHaveBeenCalled();
  });

  it("returns 404 when the team no longer exists", async () => {
    mockGetTeam.mockResolvedValue(null);

    await expect(
      DELETE(
        makeEvent(TEAM_ID, "user-1", { confirmName: "Core Team" }, "DELETE"),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockDeleteTeam).not.toHaveBeenCalled();
  });

  it("returns 404 without notifying when the delete affects nothing", async () => {
    mockDeleteTeam.mockResolvedValue({
      deleted: false,
      counterIds: [],
      dashboardIds: [],
      memberIds: [],
    });

    await expect(
      DELETE(
        makeEvent(TEAM_ID, "user-1", { confirmName: "Core Team" }, "DELETE"),
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockEmitTeamMembershipChanged).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    await expect(
      DELETE(makeEvent(TEAM_ID, null, { confirmName: "Core Team" }, "DELETE")),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns 404 for non-members", async () => {
    mockCanDeleteTeam.mockResolvedValue(false);
    mockCanViewTeam.mockResolvedValue(false);
    await expect(
      DELETE(
        makeEvent(TEAM_ID, "user-1", { confirmName: "Core Team" }, "DELETE"),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns 403 for non-owner members", async () => {
    mockCanDeleteTeam.mockResolvedValue(false);
    await expect(
      DELETE(
        makeEvent(TEAM_ID, "user-1", { confirmName: "Core Team" }, "DELETE"),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns 400 when confirmName does not match", async () => {
    const response = await DELETE(
      makeEvent(TEAM_ID, "user-1", { confirmName: "core team" }, "DELETE"),
    );

    expect(response.status).toBe(400);
    expect(mockDeleteTeam).not.toHaveBeenCalled();
  });

  it("lets platform admins delete teams they are not a member of", async () => {
    mockCanViewTeam.mockResolvedValue(false);
    mockGetUserTeamRole.mockResolvedValue(null);
    mockDeleteTeam.mockResolvedValue({
      deleted: true,
      counterIds: [],
      dashboardIds: [],
      memberIds: ["user-1", "user-2"],
    });

    const response = await DELETE(
      makeEvent(TEAM_ID, "admin-1", { confirmName: "Core Team" }, "DELETE"),
    );

    expect(response.status).toBe(200);
    expect(mockCanDeleteTeam).toHaveBeenCalledWith("admin-1", TEAM_ID);
    expect(mockDeleteTeam).toHaveBeenCalledWith(TEAM_ID, "admin-1");
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(
      ["user-1", "user-2"],
      { teamId: TEAM_ID, reason: "team_deleted" },
    );
  });

  it("returns 400 when confirmName is missing", async () => {
    const response = await DELETE(makeEvent(TEAM_ID, "admin-1", {}, "DELETE"));

    expect(response.status).toBe(400);
    expect(mockDeleteTeam).not.toHaveBeenCalled();
  });

  it("deletes the team when confirmName matches", async () => {
    mockDeleteTeam.mockResolvedValue({
      deleted: true,
      counterIds: ["c1"],
      dashboardIds: ["d1"],
      memberIds: ["user-1", "user-2"],
    });

    const response = await DELETE(
      makeEvent(TEAM_ID, "user-1", { confirmName: "Core Team" }, "DELETE"),
    );

    expect(response.status).toBe(200);
    expect(mockDeleteTeam).toHaveBeenCalledWith(TEAM_ID, "user-1");
    expect(await response.json()).toEqual({
      success: true,
      counterIds: ["c1"],
      dashboardIds: ["d1"],
    });
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(
      ["user-1", "user-2"],
      { teamId: TEAM_ID, reason: "team_deleted" },
    );
  });
});
