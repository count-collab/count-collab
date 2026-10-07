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

function makeEvent(userId: string | null) {
  return {
    params: { id: COUNTER_ID },
    url: new URL(`http://localhost/api/counters/${COUNTER_ID}/follow`),
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
