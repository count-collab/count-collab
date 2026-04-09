import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockHasPermission = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("$lib/server/permissions", () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });

import {
  canDeleteDashboard,
  canEditDashboard,
  canManageDashboardMembers,
  canViewDashboard,
  isDashboardOwner,
} from "./dashboard-authorize";

function mockDbResponses(...responses: unknown[]) {
  mockWhere.mockReset();
  for (const response of responses) {
    mockWhere.mockResolvedValueOnce(response);
  }
}

describe("dashboard authorize helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockHasPermission.mockResolvedValue(false);
  });

  describe("isDashboardOwner", () => {
    it("returns true when user is owner", async () => {
      mockDbResponses([{ ownerId: "user-1" }]);

      await expect(isDashboardOwner("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
    });

    it("returns false when user is not owner", async () => {
      mockDbResponses([{ ownerId: "other-user" }]);

      await expect(isDashboardOwner("user-1", "dashboard-1")).resolves.toBe(
        false,
      );
    });
  });

  describe("canEditDashboard", () => {
    it("allows the dashboard owner", async () => {
      mockDbResponses([{ ownerId: "user-1" }]);

      await expect(canEditDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("allows editor and admin members", async () => {
      for (const role of ["editor", "admin"] as const) {
        mockDbResponses([{ ownerId: "owner-1" }], [{ role }]);

        await expect(
          canEditDashboard("user-1", `dashboard-${role}`),
        ).resolves.toBe(true);
      }

      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("denies viewer members without global permission", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], [{ role: "viewer" }]);

      await expect(canEditDashboard("user-1", "dashboard-1")).resolves.toBe(
        false,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:edit_any",
      );
    });

    it("allows non-members with global dashboard:edit_any", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);
      mockHasPermission.mockResolvedValueOnce(true);

      await expect(canEditDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:edit_any",
      );
    });
  });

  describe("canDeleteDashboard", () => {
    it("allows the dashboard owner", async () => {
      mockDbResponses([{ ownerId: "user-1" }]);

      await expect(canDeleteDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("allows admin members only", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], [{ role: "admin" }]);

      await expect(canDeleteDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("denies editor members", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], [{ role: "editor" }]);

      await expect(canDeleteDashboard("user-1", "dashboard-1")).resolves.toBe(
        false,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:delete_any",
      );
    });

    it("denies viewer members", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], [{ role: "viewer" }]);

      await expect(canDeleteDashboard("user-1", "dashboard-1")).resolves.toBe(
        false,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:delete_any",
      );
    });

    it("allows non-members with global dashboard:delete_any", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);
      mockHasPermission.mockResolvedValueOnce(true);

      await expect(canDeleteDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:delete_any",
      );
    });
  });

  describe("canManageDashboardMembers", () => {
    it("allows the dashboard owner", async () => {
      mockDbResponses([{ ownerId: "user-1" }]);

      await expect(
        canManageDashboardMembers("user-1", "dashboard-1"),
      ).resolves.toBe(true);
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("allows admin members", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], [{ role: "admin" }]);

      await expect(
        canManageDashboardMembers("user-1", "dashboard-1"),
      ).resolves.toBe(true);
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("denies editor members", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], [{ role: "editor" }]);

      await expect(
        canManageDashboardMembers("user-1", "dashboard-1"),
      ).resolves.toBe(false);
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:edit_any",
      );
    });

    it("denies viewer members", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], [{ role: "viewer" }]);

      await expect(
        canManageDashboardMembers("user-1", "dashboard-1"),
      ).resolves.toBe(false);
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:edit_any",
      );
    });

    it("allows with global dashboard:edit_any", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);
      mockHasPermission.mockResolvedValueOnce(true);

      await expect(
        canManageDashboardMembers("user-1", "dashboard-1"),
      ).resolves.toBe(true);
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:edit_any",
      );
    });
  });

  describe("canViewDashboard", () => {
    it("allows the dashboard owner", async () => {
      mockDbResponses([{ ownerId: "user-1" }]);

      await expect(canViewDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("allows any member (viewer, editor, admin)", async () => {
      for (const role of ["viewer", "editor", "admin"] as const) {
        mockDbResponses([{ ownerId: "owner-1" }], [{ role }]);

        await expect(
          canViewDashboard("user-1", `dashboard-${role}`),
        ).resolves.toBe(true);
      }

      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("denies non-members without global permission", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);

      await expect(canViewDashboard("user-1", "dashboard-1")).resolves.toBe(
        false,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:edit_any",
      );
    });

    it("allows with global dashboard:edit_any", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);
      mockHasPermission.mockResolvedValueOnce(true);

      await expect(canViewDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:edit_any",
      );
    });
  });
});
