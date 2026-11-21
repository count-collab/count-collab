import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCounter, getCounterStats, getCounterUserStats } =
  vi.hoisted(() => ({
    getCounter: vi.fn(),
    getCounterStats: vi.fn(),
    getCounterUserStats: vi.fn(),
  }));

vi.mock("$lib/server/counters", () => ({
  getCounter,
  getCounterStats,
  getCounterUserStats,
}));
vi.mock("$lib/server/authorize", () => ({
  canViewPrivateCounter: vi.fn(),
}));

import { GET } from "./+server";

const id = "2f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("counter statistics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCounter.mockResolvedValue({ id, visibilityMode: "public" });
    getCounterStats.mockResolvedValue({ total: 5 });
    getCounterUserStats.mockResolvedValue({ totals: { total: 3 } });
  });

  it.each([null, "user-1"])("returns all activity and personal stats for user %s", async (userId) => {
    const response = await GET({
      params: { id },
      locals: { auth: async () => userId ? { user: { id: userId } } : null },
    } as never);

    expect(await response.json()).toEqual({
      userStats: userId ? { totals: { total: 3 } } : null,
      counterStats: { total: 5 },
    });
    expect(getCounterStats).toHaveBeenCalledWith(id);
    if (userId) {
      expect(getCounterUserStats).toHaveBeenCalledWith(id, userId);
    } else {
      expect(getCounterUserStats).not.toHaveBeenCalled();
    }
  });
});
