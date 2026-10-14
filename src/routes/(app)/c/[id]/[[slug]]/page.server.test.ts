import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCounter,
  mockCanViewPrivateCounter,
  mockCanManageMembers,
  mockCanIncrementPrivateCounter,
  mockCheckCounterCooldown,
} = vi.hoisted(() => ({
  mockGetCounter: vi.fn(),
  mockCanViewPrivateCounter: vi.fn(),
  mockCanManageMembers: vi.fn(),
  mockCanIncrementPrivateCounter: vi.fn(),
  mockCheckCounterCooldown: vi.fn(),
}));

// Only the goals query (select/from/where/orderBy) is reached in these tests
vi.mock("$lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ orderBy: async () => [] }) }),
    }),
  },
}));
vi.mock("$lib/server/counters", () => ({
  getCounter: mockGetCounter,
  getCounterAnonymousStats: vi.fn(),
  getCounterHistory: vi.fn(),
  getCounterUserStats: vi.fn(),
}));
vi.mock("$lib/server/authorize", () => ({
  canDeleteCounter: vi.fn(),
  canEditCounter: vi.fn(),
  canIncrementCounter: vi.fn(),
  canIncrementPrivateCounter: mockCanIncrementPrivateCounter,
  canManageMembers: mockCanManageMembers,
  canViewPrivateCounter: mockCanViewPrivateCounter,
  getCounterAccess: vi.fn(),
}));
vi.mock("$lib/server/followers", () => ({
  getCounterFollowerCount: vi.fn(),
  isFollowingCounter: vi.fn(),
}));
vi.mock("$lib/server/invitations", () => ({ getCounterInvitations: vi.fn() }));
vi.mock("$lib/server/members", () => ({ getCounterMembers: vi.fn() }));
vi.mock("$lib/server/ratelimit", () => ({
  checkCounterCooldown: mockCheckCounterCooldown,
}));
vi.mock("$lib/server/team-authorize", () => ({ getActingTeamRole: vi.fn() }));
vi.mock("$lib/server/teams", () => ({
  getTeam: vi.fn(),
  listEditableTeams: vi.fn(),
}));
vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { load } from "./+page.server";

const ID = "2f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(opts: { userId?: string; slug?: string; search?: string }) {
  return {
    params: { id: ID, slug: opts.slug },
    depends: vi.fn(),
    locals: {
      auth: vi.fn(async () =>
        opts.userId ? { user: { id: opts.userId } } : null,
      ),
    },
    url: new URL(`http://localhost/c/${ID}${opts.search ?? ""}`),
  } as never;
}

async function loadError(event: never) {
  try {
    await (load as (e: never) => Promise<unknown>)(event);
  } catch (err) {
    return err as { status: number; location?: string };
  }
  throw new Error("load did not throw");
}

const privateCounter = {
  id: ID,
  title: "Secret Plans",
  visibilityMode: "private",
  shareToken: "tok123",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckCounterCooldown.mockResolvedValue({
    blocked: false,
    cooldownSeconds: 0,
  });
});

describe("counter page canonical slug redirect", () => {
  it("redirects public counters with a wrong slug", async () => {
    mockGetCounter.mockResolvedValue({
      id: ID,
      title: "Public One",
      visibilityMode: "public",
    });

    const err = await loadError(makeEvent({ slug: "wrong" }));

    expect(err).toMatchObject({
      status: 301,
      location: `/c/${ID}/public-one`,
    });
  });

  it("returns 404 instead of a redirect for anonymous callers on private counters", async () => {
    mockGetCounter.mockResolvedValue(privateCounter);

    const err = await loadError(makeEvent({ slug: "wrong" }));

    expect(err.status).toBe(404);
    expect(err.location).toBeUndefined();
  });

  it("returns 404 instead of a redirect for signed-in users without access", async () => {
    mockGetCounter.mockResolvedValue(privateCounter);
    mockCanViewPrivateCounter.mockResolvedValue(false);

    const err = await loadError(makeEvent({ userId: "u1", slug: "wrong" }));

    expect(err.status).toBe(404);
    expect(err.location).toBeUndefined();
  });

  it("returns 404 for a wrong share token", async () => {
    mockGetCounter.mockResolvedValue(privateCounter);

    const err = await loadError(
      makeEvent({ slug: "wrong", search: "?token=nope" }),
    );

    expect(err.status).toBe(404);
  });

  it("redirects authorized users on private counters", async () => {
    mockGetCounter.mockResolvedValue(privateCounter);
    mockCanViewPrivateCounter.mockResolvedValue(true);

    const err = await loadError(makeEvent({ userId: "u1", slug: "wrong" }));

    expect(err).toMatchObject({
      status: 301,
      location: `/c/${ID}/secret-plans`,
    });
  });

  it("redirects holders of a valid share token and keeps the query", async () => {
    mockGetCounter.mockResolvedValue(privateCounter);

    const err = await loadError(
      makeEvent({ slug: "wrong", search: "?token=tok123" }),
    );

    expect(err).toMatchObject({
      status: 301,
      location: `/c/${ID}/secret-plans?token=tok123`,
    });
  });
});

describe("counter page share token exposure", () => {
  const fullPrivate = {
    ...privateCounter,
    description: null,
    count: 3,
    ownerId: null,
    teamId: null,
    scoreboardEnabled: false,
    cooldownEnabled: false,
    cooldownSeconds: 0,
    lastActivityAt: new Date(),
  };

  type CounterPageData = {
    counter: Record<string, unknown>;
    shareToken: string | null;
    hasValidToken: boolean;
    canIncrement: boolean;
  };

  async function loadData(event: never) {
    return (await (load as (e: never) => Promise<unknown>)(
      event,
    )) as CounterPageData;
  }

  beforeEach(() => {
    mockGetCounter.mockResolvedValue(fullPrivate);
    mockCanManageMembers.mockResolvedValue(false);
    mockCanViewPrivateCounter.mockResolvedValue(true);
    mockCanIncrementPrivateCounter.mockResolvedValue("forbidden");
  });

  it("includes the token only in the manager-only field for managers", async () => {
    mockCanManageMembers.mockResolvedValue(true);

    const data = await loadData(
      makeEvent({ userId: "owner", slug: "secret-plans" }),
    );

    expect(data.shareToken).toBe("tok123");
    expect(data.counter).not.toHaveProperty("shareToken");
  });

  it("omits the token for a signed-in viewer", async () => {
    const data = await loadData(
      makeEvent({ userId: "viewer", slug: "secret-plans" }),
    );

    expect(data.shareToken).toBeNull();
    expect(data.counter).not.toHaveProperty("shareToken");
    expect(JSON.stringify(data)).not.toContain("tok123");
  });

  it("omits the token for an anonymous holder of a valid token", async () => {
    const data = await loadData(
      makeEvent({ slug: "secret-plans", search: "?token=tok123" }),
    );

    expect(data.hasValidToken).toBe(true);
    expect(data.shareToken).toBeNull();
    expect(data.counter).not.toHaveProperty("shareToken");
    expect(JSON.stringify(data)).not.toContain("tok123");
  });

  it("omits the token for a token holder who cannot manage", async () => {
    mockCanManageMembers.mockResolvedValue(false);

    const data = await loadData(
      makeEvent({
        userId: "viewer",
        slug: "secret-plans",
        search: "?token=tok123",
      }),
    );

    expect(data.shareToken).toBeNull();
    expect(JSON.stringify(data)).not.toContain("tok123");
  });

  it.each([
    ["wrong-length", "?token=tok"],
    ["longer", "?token=tok123tok123"],
    ["empty", "?token="],
    ["missing", ""],
  ])("rejects a %s token for anonymous callers", async (_label, search) => {
    const err = await loadError(makeEvent({ slug: "secret-plans", search }));

    expect(err.status).toBe(404);
  });

  it("rejects any token when the stored token is null", async () => {
    mockGetCounter.mockResolvedValue({ ...fullPrivate, shareToken: null });

    for (const search of ["?token=null", "?token=undefined", "?token="]) {
      const err = await loadError(makeEvent({ slug: "secret-plans", search }));
      expect(err.status).toBe(404);
    }
  });

  it("ignores the token on public counters", async () => {
    mockGetCounter.mockResolvedValue({
      ...fullPrivate,
      title: "Public One",
      visibilityMode: "public",
    });

    const data = await loadData(
      makeEvent({ slug: "public-one", search: "?token=tok123" }),
    );

    expect(data.hasValidToken).toBe(false);
    expect(data.shareToken).toBeNull();
    expect(data.counter).not.toHaveProperty("shareToken");
  });

  it("keeps canIncrement aligned with the API for private counters", async () => {
    const viewer = await loadData(
      makeEvent({ userId: "viewer", slug: "secret-plans" }),
    );
    expect(viewer.canIncrement).toBe(false);

    mockCanIncrementPrivateCounter.mockResolvedValue("allowed");
    const member = await loadData(
      makeEvent({ userId: "viewer", slug: "secret-plans" }),
    );
    expect(member.canIncrement).toBe(true);

    const tokenHolder = await loadData(
      makeEvent({ slug: "secret-plans", search: "?token=tok123" }),
    );
    expect(tokenHolder.canIncrement).toBe(true);
  });
});
