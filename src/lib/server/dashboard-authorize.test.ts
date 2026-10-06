import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockLeftJoin = vi.fn();
const mockWhere = vi.fn();
const mockHasPermission = vi.fn();
const mockIsFollowingDashboard = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("$lib/server/permissions", () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock("$lib/server/followers", () => ({
  isFollowingDashboard: (...args: unknown[]) =>
    mockIsFollowingDashboard(...args),
}));

function setupQueryChain() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ leftJoin: mockLeftJoin });
  mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
}

setupQueryChain();

import {
  canDeleteDashboard,
  canEditDashboard,
  canManageDashboardMembers,
  canViewDashboard,
  getDashboardAccess,
  isDashboardOwner,
} from "./dashboard-authorize";

type AccessRow = {
  ownerId: string | null;
  teamId: string | null;
  directRole: string | null;
  teamRole: string | null;
};

function mockAccessRow(row: Partial<AccessRow>) {
  mockWhere.mockReset();
  mockWhere.mockResolvedValueOnce([
    {
      ownerId: "owner-1",
      teamId: null,
      directRole: null,
      teamRole: null,
      ...row,
    },
  ]);
}

/** Legacy shape: dashboard rows + direct-member rows, merged into one joined row. */
function mockDbResponses(
  dashboardRows: { ownerId: string }[],
  memberRows: { role: string }[] = [],
) {
  mockAccessRow({
    ownerId: dashboardRows[0]?.ownerId,
    directRole: memberRows[0]?.role ?? null,
  });
}

describe("dashboard authorize helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryChain();
    mockHasPermission.mockResolvedValue(false);
    mockIsFollowingDashboard.mockResolvedValue(false);
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

    it("returns false for the creator of a team-owned dashboard", async () => {
      mockAccessRow({ ownerId: "user-1", teamId: "team-1" });

      await expect(isDashboardOwner("user-1", "dashboard-1")).resolves.toBe(
        false,
      );
    });
  });

  describe("team-owned dashboards", () => {
    it("grants access via team role", async () => {
      mockAccessRow({ teamId: "team-1", teamRole: "editor" });

      await expect(canEditDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("ignores ownerId when teamId is set", async () => {
      mockAccessRow({ ownerId: "user-1", teamId: "team-1" });

      await expect(canDeleteDashboard("user-1", "dashboard-1")).resolves.toBe(
        false,
      );
    });

    it("uses the higher of direct and team role", async () => {
      mockAccessRow({
        teamId: "team-1",
        directRole: "viewer",
        teamRole: "owner",
      });

      await expect(
        getDashboardAccess("user-1", "dashboard-1"),
      ).resolves.toMatchObject({ effectiveRole: "admin", isOwner: false });
    });

    it("treats a team incrementer as a dashboard viewer", async () => {
      mockAccessRow({ teamId: "team-1", teamRole: "incrementer" });
      await expect(
        getDashboardAccess("user-1", "dashboard-1"),
      ).resolves.toMatchObject({ effectiveRole: "viewer" });

      mockAccessRow({ teamId: "team-1", teamRole: "incrementer" });
      await expect(canViewDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );

      mockAccessRow({ teamId: "team-1", teamRole: "incrementer" });
      await expect(canEditDashboard("user-1", "dashboard-1")).resolves.toBe(
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

    it("allows a follower who is not owner or member", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);
      mockIsFollowingDashboard.mockResolvedValueOnce(true);

      await expect(canViewDashboard("user-1", "dashboard-1")).resolves.toBe(
        true,
      );
      expect(mockIsFollowingDashboard).toHaveBeenCalledWith(
        "user-1",
        "dashboard-1",
      );
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("denies non-owner, non-member, non-follower without global permission", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);

      await expect(canViewDashboard("user-1", "dashboard-1")).resolves.toBe(
        false,
      );
      expect(mockIsFollowingDashboard).toHaveBeenCalledWith(
        "user-1",
        "dashboard-1",
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "dashboard:edit_any",
      );
    });
  });
});
