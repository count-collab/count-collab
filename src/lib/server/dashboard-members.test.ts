import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardMember } from "$lib/db/schema";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertOnConflictDoUpdate = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDeleteReturning = vi.fn();

const mockLoggerInfo = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
  },
}));

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockInsert.mockReturnValue({ values: mockInsertValues });
mockInsertValues.mockReturnValue({
  onConflictDoUpdate: mockInsertOnConflictDoUpdate,
});
mockInsertOnConflictDoUpdate.mockReturnValue({
  returning: mockInsertReturning,
});
mockUpdate.mockReturnValue({ set: mockUpdateSet });
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
mockDelete.mockReturnValue({ where: mockDeleteWhere });
mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });

import {
  getUserDashboardRole,
  inviteUserByUsername,
  removeDashboardMember,
  updateDashboardMemberRole,
} from "./dashboard-members";

function makeMember(overrides: Partial<DashboardMember> = {}): DashboardMember {
  return {
    id: 1,
    dashboardId: "dashboard-1",
    userId: "user-1",
    role: "viewer",
    invitedAt: new Date(),
    ...overrides,
  };
}

describe("dashboard members service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({
      onConflictDoUpdate: mockInsertOnConflictDoUpdate,
    });
    mockInsertOnConflictDoUpdate.mockReturnValue({
      returning: mockInsertReturning,
    });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });
  });

  describe("inviteUserByUsername", () => {
    it("successfully invites a user with the specified role", async () => {
      const member = makeMember({ role: "editor" });
      mockWhere.mockResolvedValueOnce([{ id: "user-1" }]);
      mockInsertReturning.mockResolvedValueOnce([member]);

      await expect(
        inviteUserByUsername("dashboard-1", "alice", "editor"),
      ).resolves.toEqual(member);

      expect(mockInsertValues).toHaveBeenCalledWith({
        dashboardId: "dashboard-1",
        userId: "user-1",
        role: "editor",
      });
      expect(mockInsertOnConflictDoUpdate).toHaveBeenCalledWith({
        target: expect.any(Array),
        set: { role: "editor" },
      });
      expect(mockLoggerInfo).toHaveBeenCalledWith("User invited to dashboard", {
        dashboardId: "dashboard-1",
        username: "alice",
        role: "editor",
        userId: "user-1",
      });
    });

    it("returns null when user is not found", async () => {
      mockWhere.mockResolvedValueOnce([]);

      await expect(
        inviteUserByUsername("dashboard-1", "unknown", "viewer"),
      ).resolves.toBeNull();

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("upserts role on conflict", async () => {
      const member = makeMember({ role: "admin" });
      mockWhere.mockResolvedValueOnce([{ id: "user-1" }]);
      mockInsertReturning.mockResolvedValueOnce([member]);

      await expect(
        inviteUserByUsername("dashboard-1", "alice", "admin"),
      ).resolves.toEqual(member);

      expect(mockInsertOnConflictDoUpdate).toHaveBeenCalledWith({
        target: expect.any(Array),
        set: { role: "admin" },
      });
    });
  });

  describe("getUserDashboardRole", () => {
    it("returns the role when user is a member", async () => {
      mockWhere.mockResolvedValueOnce([{ role: "editor" }]);

      await expect(getUserDashboardRole("user-1", "dashboard-1")).resolves.toBe(
        "editor",
      );
    });

    it("returns null when user is not a member", async () => {
      mockWhere.mockResolvedValueOnce([]);

      await expect(
        getUserDashboardRole("user-1", "dashboard-1"),
      ).resolves.toBeNull();
    });
  });

  describe("removeDashboardMember", () => {
    it("returns true when member is removed", async () => {
      mockDeleteReturning.mockResolvedValueOnce([makeMember()]);

      await expect(
        removeDashboardMember("dashboard-1", "user-1"),
      ).resolves.toBe(true);
    });

    it("returns false when member does not exist", async () => {
      mockDeleteReturning.mockResolvedValueOnce([]);

      await expect(
        removeDashboardMember("dashboard-1", "user-1"),
      ).resolves.toBe(false);
    });
  });

  describe("updateDashboardMemberRole", () => {
    it("updates the role successfully", async () => {
      const member = makeMember({ role: "admin" });
      mockUpdateReturning.mockResolvedValueOnce([member]);

      await expect(
        updateDashboardMemberRole("dashboard-1", "user-1", "admin"),
      ).resolves.toEqual(member);

      expect(mockUpdateSet).toHaveBeenCalledWith({ role: "admin" });
    });

    it("returns null when member not found", async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);

      await expect(
        updateDashboardMemberRole("dashboard-1", "user-1", "editor"),
      ).resolves.toBeNull();
    });
  });
});
