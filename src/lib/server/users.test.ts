import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLeftJoin = vi.fn();
const mockOrderBy = vi.fn();
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDeleteReturning = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockDelete.mockReturnValue({ where: mockDeleteWhere });
mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });

import { deleteUser, getConnectedProviders, getUserDetail } from "./users";

describe("deleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
  });

  it("deletes owned counters first, then deletes user, returns true", async () => {
    // First delete call (counters): db.delete(counters).where(...) — awaited directly
    mockDeleteWhere.mockResolvedValueOnce(undefined);
    // Second delete call (users): db.delete(users).where(...).returning()
    mockDeleteWhere.mockReturnValueOnce({ returning: mockDeleteReturning });
    mockDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    const result = await deleteUser("user-1");

    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(2);
  });

  it("returns false when user not found", async () => {
    mockDeleteWhere.mockResolvedValueOnce(undefined);
    mockDeleteWhere.mockReturnValueOnce({ returning: mockDeleteReturning });
    mockDeleteReturning.mockResolvedValueOnce([]);

    const result = await deleteUser("nonexistent");

    expect(result).toBe(false);
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });
});

describe("getConnectedProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
  });

  it("returns list of provider names", async () => {
    mockWhere.mockResolvedValueOnce([
      { provider: "github" },
      { provider: "google" },
    ]);

    const result = await getConnectedProviders("user-1");

    expect(result).toEqual(["github", "google"]);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledOnce();
  });

  it("returns empty array when no providers connected", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const result = await getConnectedProviders("user-1");

    expect(result).toEqual([]);
  });
});

describe("getUserDetail", () => {
  const mockUser = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    image: null,
    username: "testuser",
    roleName: "admin",
    roleId: 1,
    createdAt: new Date("2024-01-01"),
  };

  function setupUserQuery(userResult: unknown[]) {
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ leftJoin: mockLeftJoin });
    mockLeftJoin.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockResolvedValueOnce(userResult);
  }

  function setupParallelQueries(
    actionCount: number,
    counterRows: unknown[],
    dashboardRows: unknown[],
  ) {
    // totalActions: select → from → where
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockResolvedValueOnce([{ count: actionCount }]);

    // counterRows: select → from → where → orderBy
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce(counterRows);

    // dashboardRows: select → from → where → orderBy
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce(dashboardRows);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user not found", async () => {
    setupUserQuery([]);

    const result = await getUserDetail("nonexistent");

    expect(result).toBeNull();
    expect(mockSelect).toHaveBeenCalledOnce();
  });

  it("returns complete detail when user exists", async () => {
    setupUserQuery([mockUser]);
    setupParallelQueries(
      5,
      [
        {
          id: "c-1",
          title: "Counter 1",
          count: 10,
          visibilityMode: "public",
          isPublic: 1,
          counterMode: "increment",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
          actionCount: "3",
        },
      ],
      [
        {
          id: "d-1",
          title: "Dashboard 1",
          visibilityMode: "public",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
        },
      ],
    );

    const result = await getUserDetail("user-1");

    expect(result).toEqual({
      user: mockUser,
      actionCount: 5,
      ownedCounters: [
        {
          id: "c-1",
          title: "Counter 1",
          count: 10,
          visibilityMode: "public",
          isPublic: 1,
          counterMode: "increment",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
          actionCount: 3,
        },
      ],
      ownedDashboards: [
        {
          id: "d-1",
          title: "Dashboard 1",
          visibilityMode: "public",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
        },
      ],
    });
    // 1 user query + 3 parallel queries
    expect(mockSelect).toHaveBeenCalledTimes(4);
  });

  it("returns zero actionCount when no history exists", async () => {
    setupUserQuery([mockUser]);
    setupParallelQueries(0, [], []);

    const result = await getUserDetail("user-1");

    expect(result).not.toBeNull();
    expect(result?.actionCount).toBe(0);
  });

  it("returns empty arrays for counters and dashboards when user has none", async () => {
    setupUserQuery([mockUser]);
    setupParallelQueries(2, [], []);

    const result = await getUserDetail("user-1");

    expect(result).not.toBeNull();
    expect(result?.ownedCounters).toEqual([]);
    expect(result?.ownedDashboards).toEqual([]);
    expect(result?.actionCount).toBe(2);
  });
});
