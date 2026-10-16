import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockLeftJoin = vi.fn();
const mockWhere = vi.fn();
const mockHasPermission = vi.fn();
const mockIsFollowingCounter = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("$lib/server/permissions", () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock("$lib/server/followers", () => ({
  isFollowingCounter: (...args: unknown[]) => mockIsFollowingCounter(...args),
}));

function setupQueryChain() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ leftJoin: mockLeftJoin });
  mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
}

setupQueryChain();

import {
  canDeleteCounter,
  canEditCounter,
  canIncrementCounter,
  canIncrementPrivateCounter,
  canManageMembers,
  canViewPrivateCounter,
  getCounterAccess,
} from "./authorize";

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

/** Legacy shape: counter rows + direct-member rows, merged into one joined row. */
function mockDbResponses(
  counterRows: { ownerId: string }[],
  memberRows: { role: string }[] = [],
) {
  mockAccessRow({
    ownerId: counterRows[0]?.ownerId,
    directRole: memberRows[0]?.role ?? null,
  });
}

describe("authorize helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryChain();
    mockHasPermission.mockResolvedValue(false);
    mockIsFollowingCounter.mockResolvedValue(false);
  });

  describe("canIncrementCounter", () => {
    it("allows the counter owner", async () => {
      mockDbResponses([{ ownerId: "user-1" }]);

      await expect(canIncrementCounter("user-1", "counter-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("allows incrementer, editor, and admin members", async () => {
      for (const role of ["incrementer", "editor", "admin"] as const) {
        mockDbResponses([{ ownerId: "owner-1" }], [{ role }]);

        await expect(
          canIncrementCounter("user-1", `counter-${role}`),
        ).resolves.toBe(true);
      }

      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("denies viewer members without global permission", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], [{ role: "viewer" }]);

      await expect(canIncrementCounter("user-1", "counter-1")).resolves.toBe(
        false,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "counter:edit_any",
      );
    });

    it("allows non-members with global counter:edit_any", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);
      mockHasPermission.mockResolvedValueOnce(true);

      await expect(canIncrementCounter("user-1", "counter-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "counter:edit_any",
      );
    });

    it("denies non-members without global permission", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);

      await expect(canIncrementCounter("user-1", "counter-1")).resolves.toBe(
        false,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "counter:edit_any",
      );
    });
  });

  it("keeps edit semantics unchanged for incrementer members", async () => {
    mockDbResponses([{ ownerId: "owner-1" }], [{ role: "incrementer" }]);

    await expect(canEditCounter("user-1", "counter-1")).resolves.toBe(false);
    expect(mockHasPermission).toHaveBeenCalledWith(
      "user-1",
      "counter:edit_any",
    );
  });

  it("keeps delete semantics unchanged for editor members", async () => {
    mockDbResponses([{ ownerId: "owner-1" }], [{ role: "editor" }]);

    await expect(canDeleteCounter("user-1", "counter-1")).resolves.toBe(false);
    expect(mockHasPermission).toHaveBeenCalledWith(
      "user-1",
      "counter:delete_any",
    );
  });

  it("keeps member management semantics unchanged for incrementer members", async () => {
    mockDbResponses([{ ownerId: "owner-1" }], [{ role: "incrementer" }]);

    await expect(canManageMembers("user-1", "counter-1")).resolves.toBe(false);
    expect(mockHasPermission).toHaveBeenCalledWith(
      "user-1",
      "counter:edit_any",
    );
  });

  describe("getCounterAccess", () => {
    it("reports a missing counter", async () => {
      mockWhere.mockReset();
      mockWhere.mockResolvedValueOnce([]);

      await expect(getCounterAccess("user-1", "counter-1")).resolves.toEqual({
        exists: false,
        isOwner: false,
        teamId: null,
        directRole: null,
        teamRole: null,
        effectiveRole: null,
      });
    });

    it("maps team owner to counter admin", async () => {
      mockAccessRow({ teamId: "team-1", teamRole: "owner" });

      await expect(getCounterAccess("user-1", "counter-1")).resolves.toEqual({
        exists: true,
        isOwner: false,
        teamId: "team-1",
        directRole: null,
        teamRole: "owner",
        effectiveRole: "admin",
      });
    });
  });

  describe("team-owned counters", () => {
    it("grants access via team role", async () => {
      mockAccessRow({ teamId: "team-1", teamRole: "incrementer" });
      await expect(canIncrementCounter("user-1", "counter-1")).resolves.toBe(
        true,
      );

      mockAccessRow({ teamId: "team-1", teamRole: "incrementer" });
      await expect(canEditCounter("user-1", "counter-1")).resolves.toBe(false);
    });

    it("ignores ownerId when teamId is set", async () => {
      mockAccessRow({ ownerId: "user-1", teamId: "team-1" });

      await expect(canDeleteCounter("user-1", "counter-1")).resolves.toBe(
        false,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "counter:delete_any",
      );
    });

    it("uses the higher of direct and team role", async () => {
      mockAccessRow({
        teamId: "team-1",
        directRole: "admin",
        teamRole: "viewer",
      });
      await expect(canManageMembers("user-1", "counter-1")).resolves.toBe(true);

      mockAccessRow({
        teamId: "team-1",
        directRole: "viewer",
        teamRole: "editor",
      });
      await expect(canEditCounter("user-1", "counter-1")).resolves.toBe(true);
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("lets any team member view a private counter", async () => {
      mockAccessRow({ teamId: "team-1", teamRole: "viewer" });

      await expect(canViewPrivateCounter("user-1", "counter-1")).resolves.toBe(
        true,
      );
      expect(mockIsFollowingCounter).not.toHaveBeenCalled();
    });
  });

  describe("canViewPrivateCounter", () => {
    it("allows viewer members", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], [{ role: "viewer" }]);

      await expect(canViewPrivateCounter("user-1", "counter-1")).resolves.toBe(
        true,
      );
      expect(mockIsFollowingCounter).not.toHaveBeenCalled();
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("allows a follower who is not owner or member", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);
      mockIsFollowingCounter.mockResolvedValueOnce(true);

      await expect(canViewPrivateCounter("user-1", "counter-1")).resolves.toBe(
        true,
      );
      expect(mockIsFollowingCounter).toHaveBeenCalledWith(
        "user-1",
        "counter-1",
      );
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("denies non-owner, non-member, non-follower without global permission", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);

      await expect(canViewPrivateCounter("user-1", "counter-1")).resolves.toBe(
        false,
      );
      expect(mockIsFollowingCounter).toHaveBeenCalledWith(
        "user-1",
        "counter-1",
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "counter:edit_any",
      );
    });

    it("allows non-follower with global counter:edit_any", async () => {
      mockDbResponses([{ ownerId: "owner-1" }], []);
      mockHasPermission.mockResolvedValueOnce(true);

      await expect(canViewPrivateCounter("user-1", "counter-1")).resolves.toBe(
        true,
      );
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "counter:edit_any",
      );
    });
  });

  describe("canIncrementPrivateCounter", () => {
    it("returns not_found for a missing counter", async () => {
      mockWhere.mockReset();
      mockWhere.mockResolvedValueOnce([]);

      await expect(
        canIncrementPrivateCounter("user-1", "counter-1"),
      ).resolves.toBe("not_found");
    });

    it("allows the owner", async () => {
      mockAccessRow({ ownerId: "user-1" });

      await expect(
        canIncrementPrivateCounter("user-1", "counter-1"),
      ).resolves.toBe("allowed");
    });

    it("allows incrementer, editor, and admin members", async () => {
      for (const role of ["incrementer", "editor", "admin"] as const) {
        mockAccessRow({ directRole: role });

        await expect(
          canIncrementPrivateCounter("user-1", "counter-1"),
        ).resolves.toBe("allowed");
      }
    });

    it("allows team incrementers", async () => {
      mockAccessRow({ teamId: "team-1", teamRole: "incrementer" });

      await expect(
        canIncrementPrivateCounter("user-1", "counter-1"),
      ).resolves.toBe("allowed");
    });

    it("forbids direct viewer members, even if following", async () => {
      mockAccessRow({ directRole: "viewer" });
      mockIsFollowingCounter.mockResolvedValue(true);

      await expect(
        canIncrementPrivateCounter("user-1", "counter-1"),
      ).resolves.toBe("forbidden");
    });

    it("forbids team viewers", async () => {
      mockAccessRow({ teamId: "team-1", teamRole: "viewer" });

      await expect(
        canIncrementPrivateCounter("user-1", "counter-1"),
      ).resolves.toBe("forbidden");
    });

    it("allows viewers with global counter:edit_any", async () => {
      mockAccessRow({ directRole: "viewer" });
      mockHasPermission.mockResolvedValueOnce(true);

      await expect(
        canIncrementPrivateCounter("user-1", "counter-1"),
      ).resolves.toBe("allowed");
    });

    it("allows followers without a role", async () => {
      mockAccessRow({});
      mockIsFollowingCounter.mockResolvedValueOnce(true);

      await expect(
        canIncrementPrivateCounter("user-1", "counter-1"),
      ).resolves.toBe("allowed");
      expect(mockIsFollowingCounter).toHaveBeenCalledWith(
        "user-1",
        "counter-1",
      );
    });

    it("returns not_found for users with no access", async () => {
      mockAccessRow({});

      await expect(
        canIncrementPrivateCounter("user-1", "counter-1"),
      ).resolves.toBe("not_found");
    });
  });
});
