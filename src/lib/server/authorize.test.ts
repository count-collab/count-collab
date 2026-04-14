import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
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

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });

import {
  canDeleteCounter,
  canEditCounter,
  canIncrementCounter,
  canManageMembers,
  canViewPrivateCounter,
} from "./authorize";

function mockDbResponses(...responses: unknown[]) {
  mockWhere.mockReset();
  for (const response of responses) {
    mockWhere.mockResolvedValueOnce(response);
  }
}

describe("authorize helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
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
});
