import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCanViewTeam,
  mockCanManageTeam,
  mockGetActingTeamRole,
  mockGetUserTeamRole,
  mockGetTeamMembers,
  mockGetTeamInvitations,
  mockCreateTeamInvitation,
  mockGetUserByUsername,
} = vi.hoisted(() => ({
  mockCanViewTeam: vi.fn(),
  mockCanManageTeam: vi.fn(),
  mockGetActingTeamRole: vi.fn(),
  mockGetUserTeamRole: vi.fn(),
  mockGetTeamMembers: vi.fn(),
  mockGetTeamInvitations: vi.fn(),
  mockCreateTeamInvitation: vi.fn(),
  mockGetUserByUsername: vi.fn(),
}));

vi.mock("$lib/server/team-authorize", () => ({
  canViewTeam: mockCanViewTeam,
  canManageTeam: mockCanManageTeam,
  getActingTeamRole: mockGetActingTeamRole,
  getUserTeamRole: mockGetUserTeamRole,
}));

vi.mock("$lib/server/team-members", () => ({
  getTeamMembers: mockGetTeamMembers,
}));

vi.mock("$lib/server/invitations", () => ({
  getTeamInvitations: mockGetTeamInvitations,
  createTeamInvitation: mockCreateTeamInvitation,
}));

vi.mock("$lib/server/users", () => ({
  getUserByUsername: mockGetUserByUsername,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { GET, POST } from "./+server";

const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(id: string, userId: string | null, body?: unknown) {
  return {
    params: { id },
    locals: makeLocals(userId),
    request: new Request(`http://localhost/t/${id}/members`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanViewTeam.mockResolvedValue(true);
  mockCanManageTeam.mockResolvedValue(true);
  mockGetActingTeamRole.mockResolvedValue("admin");
  mockGetUserTeamRole.mockResolvedValue(null);
  mockGetTeamMembers.mockResolvedValue([{ userId: "user-1", role: "admin" }]);
  mockGetTeamInvitations.mockResolvedValue([{ userId: "user-3" }]);
  mockGetUserByUsername.mockResolvedValue({ id: "user-2" });
  mockCreateTeamInvitation.mockResolvedValue({ userId: "user-2" });
});

describe("GET /t/[id]/members", () => {
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
  });

  it("includes invitations for managers", async () => {
    const response = await GET(makeEvent(TEAM_ID, "user-1"));
    expect(await response.json()).toEqual({
      members: [{ userId: "user-1", role: "admin" }],
      invitations: [{ userId: "user-3" }],
    });
  });

  it("omits invitations for non-managers", async () => {
    mockCanManageTeam.mockResolvedValue(false);

    const response = await GET(makeEvent(TEAM_ID, "user-1"));

    expect((await response.json()).invitations).toEqual([]);
    expect(mockGetTeamInvitations).not.toHaveBeenCalled();
  });
});

describe("POST /t/[id]/members", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(
      POST(makeEvent(TEAM_ID, null, { username: "bob", role: "viewer" })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns 404 for non-members", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    mockCanViewTeam.mockResolvedValue(false);
    await expect(
      POST(makeEvent(TEAM_ID, "user-1", { username: "bob", role: "viewer" })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns 403 when an admin tries to invite an owner", async () => {
    await expect(
      POST(makeEvent(TEAM_ID, "user-1", { username: "bob", role: "owner" })),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockCreateTeamInvitation).not.toHaveBeenCalled();
  });

  it("lets an owner invite an owner", async () => {
    mockGetActingTeamRole.mockResolvedValue("owner");

    const response = await POST(
      makeEvent(TEAM_ID, "user-1", { username: "bob", role: "owner" }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateTeamInvitation).toHaveBeenCalledWith(
      TEAM_ID,
      "user-2",
      "owner",
      "user-1",
    );
  });

  it("returns 404 when the user does not exist", async () => {
    mockGetUserByUsername.mockResolvedValue(null);
    const response = await POST(
      makeEvent(TEAM_ID, "user-1", { username: "bob", role: "viewer" }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for a self-invite", async () => {
    mockGetUserByUsername.mockResolvedValue({ id: "user-1" });
    const response = await POST(
      makeEvent(TEAM_ID, "user-1", { username: "me", role: "viewer" }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 409 when the user is already a member", async () => {
    mockGetUserTeamRole.mockResolvedValue("viewer");
    const response = await POST(
      makeEvent(TEAM_ID, "user-1", { username: "bob", role: "editor" }),
    );
    expect(response.status).toBe(409);
    expect(mockCreateTeamInvitation).not.toHaveBeenCalled();
  });
});
