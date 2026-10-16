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

import {
  canDeleteTeam,
  canEditTeamResources,
  canManageTeam,
  canViewTeam,
  getActingTeamRole,
  getUserTeamRole,
} from "./team-authorize";

function mockTeamRole(role: string | null) {
  mockWhere.mockReset();
  mockWhere.mockResolvedValueOnce(role ? [{ role }] : []);
}

describe("team authorize helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockHasPermission.mockResolvedValue(false);
  });

  it("getUserTeamRole returns the member role or null", async () => {
    mockTeamRole("editor");
    await expect(getUserTeamRole("user-1", "team-1")).resolves.toBe("editor");

    mockTeamRole(null);
    await expect(getUserTeamRole("user-1", "team-1")).resolves.toBeNull();
  });

  it("canViewTeam allows any member", async () => {
    mockTeamRole("viewer");
    await expect(canViewTeam("user-1", "team-1")).resolves.toBe(true);
    expect(mockHasPermission).not.toHaveBeenCalled();
  });

  it("canViewTeam falls back to team:edit_any for non-members", async () => {
    mockTeamRole(null);
    mockHasPermission.mockResolvedValueOnce(true);
    await expect(canViewTeam("user-1", "team-1")).resolves.toBe(true);
    expect(mockHasPermission).toHaveBeenCalledWith("user-1", "team:edit_any");
  });

  it("canEditTeamResources requires editor+", async () => {
    mockTeamRole("incrementer");
    await expect(canEditTeamResources("user-1", "team-1")).resolves.toBe(false);

    mockTeamRole("editor");
    await expect(canEditTeamResources("user-1", "team-1")).resolves.toBe(true);
  });

  it("canManageTeam requires admin+", async () => {
    mockTeamRole("editor");
    await expect(canManageTeam("user-1", "team-1")).resolves.toBe(false);
    expect(mockHasPermission).toHaveBeenCalledWith("user-1", "team:edit_any");

    mockTeamRole("admin");
    await expect(canManageTeam("user-1", "team-1")).resolves.toBe(true);
  });

  it("canDeleteTeam requires owner or team:delete_any", async () => {
    mockTeamRole("admin");
    await expect(canDeleteTeam("user-1", "team-1")).resolves.toBe(false);
    expect(mockHasPermission).toHaveBeenCalledWith("user-1", "team:delete_any");

    mockTeamRole("owner");
    await expect(canDeleteTeam("user-1", "team-1")).resolves.toBe(true);

    mockTeamRole(null);
    mockHasPermission.mockResolvedValueOnce(true);
    await expect(canDeleteTeam("user-1", "team-1")).resolves.toBe(true);
  });

  describe("getActingTeamRole", () => {
    it("returns the member role without platform permission", async () => {
      mockTeamRole("admin");
      await expect(getActingTeamRole("user-1", "team-1")).resolves.toBe(
        "admin",
      );
    });

    it("treats team:edit_any as owner", async () => {
      mockTeamRole(null);
      mockHasPermission.mockResolvedValueOnce(true);
      await expect(getActingTeamRole("user-1", "team-1")).resolves.toBe(
        "owner",
      );
    });

    it("returns null for non-members without permission", async () => {
      mockTeamRole(null);
      await expect(getActingTeamRole("user-1", "team-1")).resolves.toBeNull();
    });
  });
});
