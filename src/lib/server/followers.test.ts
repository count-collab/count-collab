import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInnerJoin = vi.fn();
const mockOrderBy = vi.fn();
const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertOnConflictDoNothing = vi.fn();
const mockInsertReturning = vi.fn();
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDeleteReturning = vi.fn();

const mockLoggerInfo = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
  },
}));

function setupChains() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere, innerJoin: mockInnerJoin });
  mockInnerJoin.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy });
  mockInsert.mockReturnValue({ values: mockInsertValues });
  mockInsertValues.mockReturnValue({
    onConflictDoNothing: mockInsertOnConflictDoNothing,
  });
  mockInsertOnConflictDoNothing.mockReturnValue({
    returning: mockInsertReturning,
  });
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
  mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });
}

setupChains();

import {
  followCounter,
  followDashboard,
  getCounterFollowerCount,
  getDashboardFollowerCount,
  getFollowedCounters,
  getFollowedDashboards,
  isFollowingCounter,
  isFollowingDashboard,
  unfollowCounter,
  unfollowDashboard,
} from "./followers";

describe("counter followers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  describe("followCounter", () => {
    it("returns true when newly followed", async () => {
      mockInsertReturning.mockResolvedValueOnce([
        { id: 1, counterId: "counter-1", userId: "user-1" },
      ]);

      const result = await followCounter("user-1", "counter-1");

      expect(result).toBe(true);
      expect(mockInsertValues).toHaveBeenCalledWith({
        counterId: "counter-1",
        userId: "user-1",
      });
      expect(mockLoggerInfo).toHaveBeenCalledWith("User followed counter", {
        userId: "user-1",
        counterId: "counter-1",
      });
    });

    it("returns false when already following (onConflictDoNothing)", async () => {
      mockInsertReturning.mockResolvedValueOnce([]);

      const result = await followCounter("user-1", "counter-1");

      expect(result).toBe(false);
      expect(mockLoggerInfo).not.toHaveBeenCalled();
    });
  });

  describe("unfollowCounter", () => {
    it("returns true when unfollowed", async () => {
      mockDeleteReturning.mockResolvedValueOnce([
        { id: 1, counterId: "counter-1", userId: "user-1" },
      ]);

      const result = await unfollowCounter("user-1", "counter-1");

      expect(result).toBe(true);
      expect(mockLoggerInfo).toHaveBeenCalledWith("User unfollowed counter", {
        userId: "user-1",
        counterId: "counter-1",
      });
    });

    it("returns false when not following", async () => {
      mockDeleteReturning.mockResolvedValueOnce([]);

      const result = await unfollowCounter("user-1", "counter-1");

      expect(result).toBe(false);
      expect(mockLoggerInfo).not.toHaveBeenCalled();
    });
  });

  describe("isFollowingCounter", () => {
    it("returns true when following", async () => {
      mockWhere.mockResolvedValueOnce([{ id: 1 }]);

      const result = await isFollowingCounter("user-1", "counter-1");

      expect(result).toBe(true);
    });

    it("returns false when not following", async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await isFollowingCounter("user-1", "counter-1");

      expect(result).toBe(false);
    });
  });

  describe("getCounterFollowerCount", () => {
    it("returns the follower count", async () => {
      mockWhere.mockResolvedValueOnce([{ count: 5 }]);

      const result = await getCounterFollowerCount("counter-1");

      expect(result).toBe(5);
    });

    it("returns 0 when no followers", async () => {
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);

      const result = await getCounterFollowerCount("counter-1");

      expect(result).toBe(0);
    });

    it("returns 0 when row is undefined", async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await getCounterFollowerCount("counter-1");

      expect(result).toBe(0);
    });
  });

  describe("getFollowedCounters", () => {
    it("returns followed counter objects", async () => {
      const counters = [
        {
          id: "counter-1",
          title: "My Counter",
          description: null,
          count: 10,
          isPublic: true,
          visibilityMode: "public",
          shareToken: "abc",
          ownerId: "owner-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockOrderBy.mockResolvedValueOnce(counters);

      const result = await getFollowedCounters("user-1");

      expect(result).toEqual(counters);
      expect(mockSelect).toHaveBeenCalledOnce();
      expect(mockInnerJoin).toHaveBeenCalledOnce();
    });

    it("returns empty array when not following any counters", async () => {
      mockOrderBy.mockResolvedValueOnce([]);

      const result = await getFollowedCounters("user-1");

      expect(result).toEqual([]);
    });
  });
});

describe("dashboard followers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  describe("followDashboard", () => {
    it("returns true when newly followed", async () => {
      mockInsertReturning.mockResolvedValueOnce([
        { id: 1, dashboardId: "dashboard-1", userId: "user-1" },
      ]);

      const result = await followDashboard("user-1", "dashboard-1");

      expect(result).toBe(true);
      expect(mockInsertValues).toHaveBeenCalledWith({
        dashboardId: "dashboard-1",
        userId: "user-1",
      });
      expect(mockLoggerInfo).toHaveBeenCalledWith("User followed dashboard", {
        userId: "user-1",
        dashboardId: "dashboard-1",
      });
    });

    it("returns false when already following (onConflictDoNothing)", async () => {
      mockInsertReturning.mockResolvedValueOnce([]);

      const result = await followDashboard("user-1", "dashboard-1");

      expect(result).toBe(false);
      expect(mockLoggerInfo).not.toHaveBeenCalled();
    });
  });

  describe("unfollowDashboard", () => {
    it("returns true when unfollowed", async () => {
      mockDeleteReturning.mockResolvedValueOnce([
        { id: 1, dashboardId: "dashboard-1", userId: "user-1" },
      ]);

      const result = await unfollowDashboard("user-1", "dashboard-1");

      expect(result).toBe(true);
      expect(mockLoggerInfo).toHaveBeenCalledWith("User unfollowed dashboard", {
        userId: "user-1",
        dashboardId: "dashboard-1",
      });
    });

    it("returns false when not following", async () => {
      mockDeleteReturning.mockResolvedValueOnce([]);

      const result = await unfollowDashboard("user-1", "dashboard-1");

      expect(result).toBe(false);
      expect(mockLoggerInfo).not.toHaveBeenCalled();
    });
  });

  describe("isFollowingDashboard", () => {
    it("returns true when following", async () => {
      mockWhere.mockResolvedValueOnce([{ id: 1 }]);

      const result = await isFollowingDashboard("user-1", "dashboard-1");

      expect(result).toBe(true);
    });

    it("returns false when not following", async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await isFollowingDashboard("user-1", "dashboard-1");

      expect(result).toBe(false);
    });
  });

  describe("getDashboardFollowerCount", () => {
    it("returns the follower count", async () => {
      mockWhere.mockResolvedValueOnce([{ count: 3 }]);

      const result = await getDashboardFollowerCount("dashboard-1");

      expect(result).toBe(3);
    });

    it("returns 0 when no followers", async () => {
      mockWhere.mockResolvedValueOnce([{ count: 0 }]);

      const result = await getDashboardFollowerCount("dashboard-1");

      expect(result).toBe(0);
    });

    it("returns 0 when row is undefined", async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await getDashboardFollowerCount("dashboard-1");

      expect(result).toBe(0);
    });
  });

  describe("getFollowedDashboards", () => {
    it("returns followed dashboard objects", async () => {
      const dashboards = [
        {
          id: "dashboard-1",
          title: "My Dashboard",
          description: null,
          visibilityMode: "public",
          shareToken: "xyz",
          ownerId: "owner-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockOrderBy.mockResolvedValueOnce(dashboards);

      const result = await getFollowedDashboards("user-1");

      expect(result).toEqual(dashboards);
      expect(mockSelect).toHaveBeenCalledOnce();
      expect(mockInnerJoin).toHaveBeenCalledOnce();
    });

    it("returns empty array when not following any dashboards", async () => {
      mockOrderBy.mockResolvedValueOnce([]);

      const result = await getFollowedDashboards("user-1");

      expect(result).toEqual([]);
    });
  });
});
