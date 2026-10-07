import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListUserTeams } = vi.hoisted(() => ({
  mockListUserTeams: vi.fn(),
}));

vi.mock("$lib/server/teams", () => ({ listUserTeams: mockListUserTeams }));

import { load } from "./+page.server";

function callLoad(userId: string | null) {
  return load({
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as unknown as Parameters<typeof load>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/my/teams load", () => {
  it("redirects anonymous users to login", async () => {
    await expect(callLoad(null)).rejects.toMatchObject({
      status: 303,
      location: "/login",
    });
  });

  it("returns the user's teams", async () => {
    const teams = [{ id: "t-1", name: "Alpha", role: "owner" }];
    mockListUserTeams.mockResolvedValue(teams);

    expect(await callLoad("user-1")).toEqual({ teams });
    expect(mockListUserTeams).toHaveBeenCalledWith("user-1");
  });
});
