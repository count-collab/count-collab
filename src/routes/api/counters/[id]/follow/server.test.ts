import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCounter, mockGetCounterAccess, mockFollowCounter } = vi.hoisted(
  () => ({
    mockGetCounter: vi.fn(),
    mockGetCounterAccess: vi.fn(),
    mockFollowCounter: vi.fn(),
  }),
);

vi.mock("$lib/server/counters", () => ({ getCounter: mockGetCounter }));
vi.mock("$lib/server/authorize", () => ({
  getCounterAccess: mockGetCounterAccess,
}));
vi.mock("$lib/server/followers", () => ({
  followCounter: mockFollowCounter,
  unfollowCounter: vi.fn(),
}));

import { POST } from "./+server";

const COUNTER_ID = "1f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(userId: string | null, search = "") {
  return {
    params: { id: COUNTER_ID },
    url: new URL(`http://localhost/api/counters/${COUNTER_ID}/follow${search}`),
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as any;
}

function access(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    isOwner: false,
    teamId: null,
    directRole: null,
    teamRole: null,
    effectiveRole: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCounter.mockResolvedValue({
    id: COUNTER_ID,
    visibilityMode: "public",
    ownerId: "owner-1",
  });
});

describe("POST /api/counters/[id]/follow", () => {
  it("returns already for the personal owner", async () => {
    mockGetCounterAccess.mockResolvedValue(access({ isOwner: true }));

    const response = await POST(makeEvent("owner-1"));

    expect(await response.json()).toEqual({ already: true });
    expect(mockFollowCounter).not.toHaveBeenCalled();
  });

  it("returns already for team members", async () => {
    mockGetCounterAccess.mockResolvedValue(
      access({ teamId: "team-1", teamRole: "viewer", effectiveRole: "viewer" }),
    );

    const response = await POST(makeEvent("user-2"));

    expect(await response.json()).toEqual({ already: true });
    expect(mockGetCounterAccess).toHaveBeenCalledWith("user-2", COUNTER_ID);
    expect(mockFollowCounter).not.toHaveBeenCalled();
  });

  it("lets the ownerId user follow a team-owned counter", async () => {
    // ownerId alone no longer counts once the counter belongs to a team
    mockGetCounterAccess.mockResolvedValue(access({ teamId: "team-1" }));
    mockFollowCounter.mockResolvedValue(true);

    const response = await POST(makeEvent("owner-1"));

    expect(response.status).toBe(201);
    expect(mockFollowCounter).toHaveBeenCalledWith("owner-1", COUNTER_ID);
  });

  it("follows when the user has no access role", async () => {
    mockGetCounterAccess.mockResolvedValue(access());
    mockFollowCounter.mockResolvedValue(true);

    const response = await POST(makeEvent("user-3"));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true });
  });
});

describe("POST /api/counters/[id]/follow (private counters)", () => {
  const TOKEN = "private-token-123";

  beforeEach(() => {
    mockGetCounter.mockResolvedValue({
      id: COUNTER_ID,
      visibilityMode: "private",
      shareToken: TOKEN,
      ownerId: "owner-1",
    });
    mockGetCounterAccess.mockResolvedValue(access());
    mockFollowCounter.mockResolvedValue(true);
  });

  it("follows with a valid token and does not echo it back", async () => {
    const response = await POST(makeEvent("user-3", `?token=${TOKEN}`));

    expect(response.status).toBe(201);
    expect(JSON.stringify(await response.json())).not.toContain(TOKEN);
    expect(mockFollowCounter).toHaveBeenCalledWith("user-3", COUNTER_ID);
  });

  it.each([
    ["missing", ""],
    ["empty", "?token="],
    ["shorter", "?token=private"],
    ["longer", `?token=${TOKEN}0`],
    ["wrong", "?token=private-token-124"],
  ])("rejects a %s token", async (_label, search) => {
    await expect(POST(makeEvent("user-3", search))).rejects.toMatchObject({
      status: 403,
    });
    expect(mockFollowCounter).not.toHaveBeenCalled();
  });

  it("rejects any token when the stored token is null", async () => {
    mockGetCounter.mockResolvedValue({
      id: COUNTER_ID,
      visibilityMode: "private",
      shareToken: null,
    });

    await expect(
      POST(makeEvent("user-3", "?token=null")),
    ).rejects.toMatchObject({ status: 403 });
  });
});
