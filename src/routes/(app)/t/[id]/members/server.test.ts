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
  mockEmitInvitationCreated,
} = vi.hoisted(() => ({
  mockCanViewTeam: vi.fn(),
  mockCanManageTeam: vi.fn(),
  mockGetActingTeamRole: vi.fn(),
  mockGetUserTeamRole: vi.fn(),
  mockGetTeamMembers: vi.fn(),
  mockGetTeamInvitations: vi.fn(),
  mockCreateTeamInvitation: vi.fn(),
  mockGetUserByUsername: vi.fn(),
  mockEmitInvitationCreated: vi.fn(),
}));

vi.mock("$lib/utils/socket", () => ({
  emitInvitationCreated: mockEmitInvitationCreated,
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

import { TeamLimitError } from "$lib/server/team-limits";
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

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mockCreateTeamInvitation).toHaveBeenCalledWith(
      TEAM_ID,
      "user-2",
      "owner",
      "user-1",
    );
  });

  it("does not leak the invitation row in the response", async () => {
    mockCreateTeamInvitation.mockResolvedValue({
      userId: "user-2",
      username: "bob",
      image: "https://example.com/a.png",
    });

    const response = await POST(
      makeEvent(TEAM_ID, "user-1", { username: "bob", role: "viewer" }),
    );

    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 500 when the invitation could not be created", async () => {
    mockCreateTeamInvitation.mockResolvedValue(null);

    const response = await POST(
      makeEvent(TEAM_ID, "user-1", { username: "bob", role: "viewer" }),
    );

    expect(response.status).toBe(500);
  });

  describe("neutral responses", () => {
    const invite = (username = "bob") =>
      POST(makeEvent(TEAM_ID, "user-1", { username, role: "editor" }));

    it("answers identically for a real invite, an unknown user and an existing member", async () => {
      const created = await invite();

      mockGetUserByUsername.mockResolvedValue(null);
      const unknown = await invite("ghost");

      mockGetUserByUsername.mockResolvedValue({ id: "user-2" });
      mockGetUserTeamRole.mockResolvedValue("viewer");
      const member = await invite();

      for (const response of [unknown, member]) {
        expect(response.status).toBe(created.status);
        expect(Object.fromEntries(response.headers)).toEqual(
          Object.fromEntries(created.headers),
        );
      }
      const bodies = await Promise.all(
        [created, unknown, member].map((r) => r.text()),
      );
      expect(new Set(bodies).size).toBe(1);
      expect(JSON.parse(bodies[0])).toEqual({ ok: true });
    });

    it("creates no invitation and emits no socket event for an unknown user", async () => {
      mockGetUserByUsername.mockResolvedValue(null);

      const response = await invite("ghost");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(mockCreateTeamInvitation).not.toHaveBeenCalled();
      expect(mockEmitInvitationCreated).not.toHaveBeenCalled();
    });

    it("creates no invitation and emits no socket event for an existing member", async () => {
      mockGetUserTeamRole.mockResolvedValue("viewer");

      const response = await invite();

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(mockCreateTeamInvitation).not.toHaveBeenCalled();
      expect(mockEmitInvitationCreated).not.toHaveBeenCalled();
    });

    it("hides a swamped recipient behind the same success response", async () => {
      mockCreateTeamInvitation.mockRejectedValue(
        new TeamLimitError("pending_recipient_limit", 409, "too many"),
      );

      const response = await invite();

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    });
  });

  describe("limit errors", () => {
    const invite = () =>
      POST(makeEvent(TEAM_ID, "user-1", { username: "bob", role: "viewer" }));

    it("maps a 409 limit to a 409 with code and no Retry-After", async () => {
      mockCreateTeamInvitation.mockRejectedValue(
        new TeamLimitError("pending_team_limit", 409, "too many pending"),
      );

      const response = await invite();

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "too many pending",
        code: "pending_team_limit",
      });
      expect(response.headers.get("Retry-After")).toBeNull();
    });

    it("maps the cooldown to 429 with Retry-After", async () => {
      mockCreateTeamInvitation.mockRejectedValue(
        new TeamLimitError("invitation_cooldown", 429, "wait", 42),
      );

      const response = await invite();

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("42");
      expect(await response.json()).toMatchObject({
        code: "invitation_cooldown",
      });
    });

    it("maps the daily cap to 429 with Retry-After", async () => {
      mockCreateTeamInvitation.mockRejectedValue(
        new TeamLimitError("daily_invitation_limit", 429, "slow down", 86400),
      );

      const response = await invite();

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("86400");
    });

    it("rethrows unexpected errors", async () => {
      mockCreateTeamInvitation.mockRejectedValue(new Error("db down"));

      await expect(invite()).rejects.toThrow("db down");
    });
  });

  it("returns 400 for a self-invite", async () => {
    mockGetUserByUsername.mockResolvedValue({ id: "user-1" });
    const response = await POST(
      makeEvent(TEAM_ID, "user-1", { username: "me", role: "viewer" }),
    );
    expect(response.status).toBe(400);
    expect(mockCreateTeamInvitation).not.toHaveBeenCalled();
  });
});
