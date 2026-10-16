import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDeleteUser, mockGetConnectedProviders, mockGetSoleOwnedTeams } =
  vi.hoisted(() => ({
    mockDeleteUser: vi.fn(),
    mockGetConnectedProviders: vi.fn(),
    mockGetSoleOwnedTeams: vi.fn(),
  }));

vi.mock("$lib/server/users", () => ({
  deleteUser: mockDeleteUser,
  getConnectedProviders: mockGetConnectedProviders,
}));

vi.mock("$lib/server/teams", () => ({
  getSoleOwnedTeams: mockGetSoleOwnedTeams,
}));

vi.mock("$lib/server/counters", () => ({
  getOwnedCounterCount: vi.fn().mockResolvedValue(3),
}));

vi.mock("$lib/server/members", () => ({
  getMembershipCount: vi.fn().mockResolvedValue(2),
}));

import { SoleTeamOwnerError } from "$lib/server/team-limits";
import { actions, load } from "./+page.server";

function makeEvent(
  user: { id: string; username?: string | null } | null,
  confirmUsername?: string,
) {
  const formData = new FormData();
  if (confirmUsername !== undefined) {
    formData.set("confirmUsername", confirmUsername);
  }
  return {
    locals: { auth: vi.fn(async () => (user ? { user } : null)) },
    request: { formData: async () => formData },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteUser.mockResolvedValue(true);
});

describe("settings load", () => {
  it("redirects anonymous users to /login", async () => {
    await expect(load(makeEvent(null))).rejects.toMatchObject({
      status: 303,
      location: "/login",
    });
  });

  it("returns the account overview with sole-owned teams", async () => {
    mockGetConnectedProviders.mockResolvedValue(["github"]);
    mockGetSoleOwnedTeams.mockResolvedValue([{ id: "t1" }]);

    const result = await load(makeEvent({ id: "u1", username: "alice" }));

    expect(result).toEqual({
      providers: ["github"],
      ownedCounterCount: 3,
      membershipCount: 2,
      soleOwnedTeams: [{ id: "t1" }],
    });
  });
});

describe("settings delete action", () => {
  const user = { id: "u1", username: "alice" };

  it("returns 401 for anonymous users", async () => {
    const result = await actions.delete(makeEvent(null, "alice"));

    expect(result).toMatchObject({ status: 401 });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it.each([
    ["a wrong username", "bob"],
    ["a different case", "ALICE"],
    ["an empty confirmation", ""],
    ["a missing confirmation", undefined],
  ])("rejects %s with 400 and deletes nothing", async (_, typed) => {
    const result = await actions.delete(makeEvent(user, typed));

    expect(result).toMatchObject({
      status: 400,
      data: { error: "Username does not match" },
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("rejects when the session has no username, even if confirmation is empty", async () => {
    for (const username of [null, undefined, ""]) {
      const result = await actions.delete(
        makeEvent({ id: "u1", username }, ""),
      );

      expect(result).toMatchObject({ status: 400 });
    }
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("deletes the account as its own actor and redirects to /home", async () => {
    await expect(
      actions.delete(makeEvent(user, "alice")),
    ).rejects.toMatchObject({ status: 303, location: "/home" });

    expect(mockDeleteUser).toHaveBeenCalledWith("u1", "u1");
  });

  it("returns 409 with the blocking teams when the user is a sole owner", async () => {
    const blocking = [{ id: "t1", name: "Alpha", memberCount: 3 }];
    mockDeleteUser.mockRejectedValue(new SoleTeamOwnerError(blocking));

    const result = await actions.delete(makeEvent(user, "alice"));

    expect(result).toMatchObject({
      status: 409,
      data: {
        error: "Transfer ownership of your teams before deleting this account",
        teams: blocking,
      },
    });
  });

  it("rethrows unexpected errors", async () => {
    mockDeleteUser.mockRejectedValue(new Error("db down"));

    await expect(actions.delete(makeEvent(user, "alice"))).rejects.toThrow(
      "db down",
    );
  });
});
