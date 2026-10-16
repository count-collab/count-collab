import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHasPermission, mockDeleteUser, mockUpdateUserRole } = vi.hoisted(
  () => ({
    mockHasPermission: vi.fn(),
    mockDeleteUser: vi.fn(),
    mockUpdateUserRole: vi.fn(),
  }),
);

vi.mock("$lib/server/permissions", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("$lib/server/users", () => ({
  deleteUser: mockDeleteUser,
  updateUserRole: mockUpdateUserRole,
}));

import { SoleTeamOwnerError } from "$lib/server/team-limits";
import { DELETE } from "./+server";

function makeEvent(actorId: string | null, userId = "target-1") {
  return {
    params: { userId },
    locals: {
      auth: vi.fn(async () => (actorId ? { user: { id: actorId } } : null)),
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHasPermission.mockResolvedValue(true);
  mockDeleteUser.mockResolvedValue(true);
});

describe("DELETE /admin/users/[userId]", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(DELETE(makeEvent(null))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 403 without the user:manage permission", async () => {
    mockHasPermission.mockResolvedValue(false);

    await expect(DELETE(makeEvent("admin-1"))).rejects.toMatchObject({
      status: 403,
    });
    expect(mockHasPermission).toHaveBeenCalledWith("admin-1", "user:manage");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("refuses to delete the acting admin", async () => {
    await expect(
      DELETE(makeEvent("admin-1", "admin-1")),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("deletes the user with the admin as actor", async () => {
    const response = await DELETE(makeEvent("admin-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockDeleteUser).toHaveBeenCalledWith("target-1", "admin-1");
  });

  it("returns 404 when the user does not exist", async () => {
    mockDeleteUser.mockResolvedValue(false);

    await expect(DELETE(makeEvent("admin-1"))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns 409 with the blocking teams when the user solely owns teams with other members", async () => {
    const blocking = [{ id: "t1", name: "Alpha", memberCount: 4 }];
    mockDeleteUser.mockRejectedValue(new SoleTeamOwnerError(blocking));

    const response = await DELETE(makeEvent("admin-1"));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Transfer ownership of your teams before deleting this account",
      teams: blocking,
    });
  });

  it("rethrows unexpected errors", async () => {
    mockDeleteUser.mockRejectedValue(new Error("db down"));

    await expect(DELETE(makeEvent("admin-1"))).rejects.toThrow("db down");
  });
});
