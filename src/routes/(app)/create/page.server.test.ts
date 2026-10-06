import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListEditableTeams } = vi.hoisted(() => ({
  mockListEditableTeams: vi.fn(),
}));

vi.mock("$lib/server/teams", () => ({
  listEditableTeams: mockListEditableTeams,
}));

import { load } from "./+page.server";

function callLoad(userId: string | null, search = "") {
  return load({
    url: new URL(`http://localhost/create${search}`),
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as unknown as Parameters<typeof load>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/create load", () => {
  it("returns no teams for anonymous users", async () => {
    expect(await callLoad(null, "?type=counter")).toEqual({
      preselectedType: "counter",
      teams: [],
    });
    expect(mockListEditableTeams).not.toHaveBeenCalled();
  });

  it("returns the user's editable teams", async () => {
    mockListEditableTeams.mockResolvedValue([{ id: "t-1", name: "Alpha" }]);

    expect(await callLoad("user-1", "?type=bogus")).toEqual({
      preselectedType: null,
      teams: [{ id: "t-1", name: "Alpha" }],
    });
    expect(mockListEditableTeams).toHaveBeenCalledWith("user-1");
  });
});
