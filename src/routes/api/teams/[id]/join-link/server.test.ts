import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCanViewTeam,
  mockCanManageTeam,
  mockEnableOrRotateJoinLink,
  mockDisableJoinLink,
  mockSetJoinLinkRole,
} = vi.hoisted(() => ({
  mockCanViewTeam: vi.fn(),
  mockCanManageTeam: vi.fn(),
  mockEnableOrRotateJoinLink: vi.fn(),
  mockDisableJoinLink: vi.fn(),
  mockSetJoinLinkRole: vi.fn(),
}));

vi.mock("$lib/server/team-authorize", () => ({
  canViewTeam: mockCanViewTeam,
  canManageTeam: mockCanManageTeam,
}));

vi.mock("$lib/server/team-members", () => ({
  enableOrRotateJoinLink: mockEnableOrRotateJoinLink,
  disableJoinLink: mockDisableJoinLink,
  setJoinLinkRole: mockSetJoinLinkRole,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { DELETE, PATCH, POST } from "./+server";

const TEAM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(userId: string | null, body?: unknown, id = TEAM_ID) {
  return {
    params: { id },
    locals: makeLocals(userId),
    request: new Request(`http://localhost/api/teams/${id}/join-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanViewTeam.mockResolvedValue(true);
  mockCanManageTeam.mockResolvedValue(true);
  mockEnableOrRotateJoinLink.mockResolvedValue("new-token");
  mockDisableJoinLink.mockResolvedValue(true);
  mockSetJoinLinkRole.mockResolvedValue(true);
});

describe("/api/teams/[id]/join-link", () => {
  it("returns 400 for an invalid id", async () => {
    await expect(
      POST(makeEvent("user-1", undefined, "nope")),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(POST(makeEvent(null))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 404 for non-members", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    mockCanViewTeam.mockResolvedValue(false);
    await expect(DELETE(makeEvent("user-1"))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns 403 for members who cannot manage", async () => {
    mockCanManageTeam.mockResolvedValue(false);
    await expect(POST(makeEvent("user-1"))).rejects.toMatchObject({
      status: 403,
    });
    expect(mockEnableOrRotateJoinLink).not.toHaveBeenCalled();
  });

  it("POST returns the new token", async () => {
    const response = await POST(makeEvent("user-1"));
    expect(await response.json()).toEqual({ token: "new-token" });
  });

  it("PATCH sets the join role", async () => {
    const response = await PATCH(makeEvent("user-1", { role: "editor" }));
    expect(response.status).toBe(200);
    expect(mockSetJoinLinkRole).toHaveBeenCalledWith(TEAM_ID, "editor");
  });

  it("PATCH rejects roles above editor", async () => {
    const response = await PATCH(makeEvent("user-1", { role: "admin" }));
    expect(response.status).toBe(400);
    expect(mockSetJoinLinkRole).not.toHaveBeenCalled();
  });

  it("POST returns 404 when the team no longer exists", async () => {
    mockEnableOrRotateJoinLink.mockResolvedValue(null);
    await expect(POST(makeEvent("user-1"))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("PATCH returns 404 when the team no longer exists", async () => {
    mockSetJoinLinkRole.mockResolvedValue(false);
    await expect(
      PATCH(makeEvent("user-1", { role: "viewer" })),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("DELETE returns 404 when the team no longer exists", async () => {
    mockDisableJoinLink.mockResolvedValue(false);
    await expect(DELETE(makeEvent("user-1"))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("DELETE disables the link", async () => {
    const response = await DELETE(makeEvent("user-1"));
    expect(await response.json()).toEqual({ success: true });
    expect(mockDisableJoinLink).toHaveBeenCalledWith(TEAM_ID);
  });
});
