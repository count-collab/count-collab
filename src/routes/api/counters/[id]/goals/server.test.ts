import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCounter, mockCanViewPrivateCounter, mockOrderBy } = vi.hoisted(
  () => ({
    mockGetCounter: vi.fn(),
    mockCanViewPrivateCounter: vi.fn(),
    mockOrderBy: vi.fn(),
  }),
);

vi.mock("$lib/db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where"]) {
    chain[m] = () => chain;
  }
  chain.orderBy = mockOrderBy;
  return { db: chain };
});

vi.mock("$lib/server/counters", () => ({ getCounter: mockGetCounter }));
vi.mock("$lib/server/authorize", () => ({
  canEditCounter: vi.fn(),
  canViewPrivateCounter: mockCanViewPrivateCounter,
}));
vi.mock("$lib/server/events", () => ({ logEvent: vi.fn() }));
vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { GET } from "./+server";

const ID = "2f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function makeEvent(userId: string | null) {
  return {
    params: { id: ID },
    locals: {
      auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)),
    },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrderBy.mockResolvedValue([{ id: 1, amount: 100 }]);
});

describe("GET /api/counters/[id]/goals", () => {
  it("returns 404 for a missing counter", async () => {
    mockGetCounter.mockResolvedValue(null);
    await expect(GET(makeEvent(null))).rejects.toMatchObject({ status: 404 });
  });

  it("serves public counters to anonymous callers", async () => {
    mockGetCounter.mockResolvedValue({ id: ID, visibilityMode: "public" });
    const response = await GET(makeEvent(null));
    expect(await response.json()).toEqual({ goals: [{ id: 1, amount: 100 }] });
  });

  it("returns 404 for private counters without a session", async () => {
    mockGetCounter.mockResolvedValue({ id: ID, visibilityMode: "private" });
    await expect(GET(makeEvent(null))).rejects.toMatchObject({ status: 404 });
    expect(mockOrderBy).not.toHaveBeenCalled();
  });

  it("returns 404 for private counters the user cannot view", async () => {
    mockGetCounter.mockResolvedValue({ id: ID, visibilityMode: "private" });
    mockCanViewPrivateCounter.mockResolvedValue(false);
    await expect(GET(makeEvent("user-1"))).rejects.toMatchObject({
      status: 404,
    });
    expect(mockOrderBy).not.toHaveBeenCalled();
  });

  it("serves private counters to authorized users", async () => {
    mockGetCounter.mockResolvedValue({ id: ID, visibilityMode: "private" });
    mockCanViewPrivateCounter.mockResolvedValue(true);
    const response = await GET(makeEvent("user-1"));
    expect(response.status).toBe(200);
  });
});
