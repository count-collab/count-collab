import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockInnerJoin,
  mockOrderBy,
  mockUpdate,
  mockUpdateSet,
  mockUpdateWhere,
  mockUpdateReturning,
  mockTransaction,
  mockTxSelect,
  mockTxFrom,
  mockTxWhere,
  mockTxUpdate,
  mockTxUpdateSet,
  mockTxUpdateWhere,
  mockTxUpdateReturning,
  mockTxInsert,
  mockTxInsertValues,
  mockTxOnConflictDoNothing,
  mockTxInsertReturning,
  mockTxDelete,
  mockTxDeleteWhere,
  mockLogEvent,
  mockHasPermission,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockOrderBy: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockTransaction: vi.fn(),
  mockTxSelect: vi.fn(),
  mockTxFrom: vi.fn(),
  mockTxWhere: vi.fn(),
  mockTxUpdate: vi.fn(),
  mockTxUpdateSet: vi.fn(),
  mockTxUpdateWhere: vi.fn(),
  mockTxUpdateReturning: vi.fn(),
  mockTxInsert: vi.fn(),
  mockTxInsertValues: vi.fn(),
  mockTxOnConflictDoNothing: vi.fn(),
  mockTxInsertReturning: vi.fn(),
  mockTxDelete: vi.fn(),
  mockTxDeleteWhere: vi.fn(),
  mockLogEvent: vi.fn(),
  mockHasPermission: vi.fn(),
}));

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("$lib/server/events", () => ({
  logEvent: mockLogEvent,
}));

vi.mock("$lib/server/permissions", () => ({
  hasPermission: mockHasPermission,
}));

import { teamInvitations, teamMembers } from "$lib/db/schema";
import {
  countTeamOwners,
  disableJoinLink,
  enableOrRotateJoinLink,
  getTeamMembers,
  joinTeamByToken,
  removeTeamMember,
  setJoinLinkRole,
  updateTeamMemberRole,
} from "./team-members";

const tx = {
  select: mockTxSelect,
  update: mockTxUpdate,
  insert: mockTxInsert,
  delete: mockTxDelete,
};

/** Query result that can be awaited directly or after `.for(...)`. */
function rows<T>(data: T[]) {
  return Object.assign(Promise.resolve(data), {
    for: () => Promise.resolve(data),
  });
}

function setupChains() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere, innerJoin: mockInnerJoin });
  mockInnerJoin.mockReturnValue({ where: mockWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });

  mockTxSelect.mockReturnValue({ from: mockTxFrom });
  mockTxFrom.mockReturnValue({ where: mockTxWhere });
  mockTxUpdate.mockReturnValue({ set: mockTxUpdateSet });
  mockTxUpdateSet.mockReturnValue({ where: mockTxUpdateWhere });
  mockTxUpdateWhere.mockReturnValue({ returning: mockTxUpdateReturning });
  mockTxInsert.mockReturnValue({ values: mockTxInsertValues });
  mockTxInsertValues.mockReturnValue({
    onConflictDoNothing: mockTxOnConflictDoNothing,
  });
  mockTxOnConflictDoNothing.mockReturnValue({
    returning: mockTxInsertReturning,
  });
  mockTxDelete.mockReturnValue({ where: mockTxDeleteWhere });
  mockTxDeleteWhere.mockResolvedValue(undefined);

  mockTransaction.mockImplementation(async (fn: (tx: any) => unknown) =>
    fn(tx),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupChains();
});

describe("getTeamMembers", () => {
  it("orders by role rank desc, keeping joinedAt order within a role", async () => {
    const member = (userId: string, role: string, day: number) => ({
      id: day,
      teamId: "team-1",
      userId,
      role,
      joinedAt: new Date(2024, 0, day),
      username: userId,
      name: null,
      image: null,
    });
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce([
      member("v1", "viewer", 1),
      member("a1", "admin", 2),
      member("o1", "owner", 3),
      member("v2", "viewer", 4),
      member("e1", "editor", 5),
    ]);

    const result = await getTeamMembers("team-1");

    expect(result.map((m) => m.userId)).toEqual(["o1", "a1", "e1", "v1", "v2"]);
  });
});

describe("countTeamOwners", () => {
  it("returns the owner count as a number", async () => {
    mockWhere.mockResolvedValueOnce([{ count: "2" }]);
    await expect(countTeamOwners("team-1")).resolves.toBe(2);
  });

  it("returns 0 when the query yields no row", async () => {
    mockWhere.mockResolvedValueOnce([]);
    await expect(countTeamOwners("team-1")).resolves.toBe(0);
  });
});

describe("updateTeamMemberRole", () => {
  it("refuses to demote the last owner", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }]))
      .mockReturnValueOnce(rows([{ role: "owner" }]));

    const result = await updateTeamMemberRole("team-1", "owner-1", "admin");

    expect(result).toEqual({
      ok: false,
      status: 409,
      message: "A team must have at least one owner",
    });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("allows demoting an owner when another owner remains", async () => {
    const updated = {
      id: 1,
      teamId: "team-1",
      userId: "owner-1",
      role: "admin",
    };
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }, { userId: "owner-2" }]))
      .mockReturnValueOnce(rows([{ role: "owner" }]));
    mockTxUpdateReturning.mockResolvedValueOnce([updated]);

    const result = await updateTeamMemberRole("team-1", "owner-1", "admin");

    expect(result).toEqual({ ok: true, member: updated });
    expect(mockTxUpdateSet).toHaveBeenCalledWith({ role: "admin" });
  });

  it("allows changing a non-owner role while there is a single owner", async () => {
    const updated = {
      id: 2,
      teamId: "team-1",
      userId: "user-2",
      role: "editor",
    };
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }]))
      .mockReturnValueOnce(rows([{ role: "viewer" }]));
    mockTxUpdateReturning.mockResolvedValueOnce([updated]);

    const result = await updateTeamMemberRole("team-1", "user-2", "editor");

    expect(result).toEqual({ ok: true, member: updated });
  });

  it("returns 404 when the user is not a member", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }]))
      .mockReturnValueOnce(rows([]));

    const result = await updateTeamMemberRole("team-1", "ghost", "editor");

    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe("updateTeamMemberRole with actor", () => {
  const ADMIN = { userId: "admin-1", actingRole: "admin" as const };

  /** Locked reads in order: owner rows, target row, actor row. */
  function queueLockedReads(
    targetRole: string | null,
    actorRole: string | null,
  ) {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }, { userId: "owner-2" }]))
      .mockReturnValueOnce(rows(targetRole ? [{ role: targetRole }] : []))
      .mockReturnValueOnce(rows(actorRole ? [{ role: actorRole }] : []));
  }

  it("rejects an admin's demotion when the target became owner concurrently", async () => {
    // The route saw "admin"; the locked re-read sees "owner"
    queueLockedReads("owner", "admin");

    const result = await updateTeamMemberRole(
      "team-1",
      "user-2",
      "viewer",
      ADMIN,
    );

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the actor was demoted below admin concurrently", async () => {
    queueLockedReads("viewer", "editor");

    const result = await updateTeamMemberRole(
      "team-1",
      "user-2",
      "editor",
      ADMIN,
    );

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the actor is no longer a member", async () => {
    queueLockedReads("viewer", null);
    mockHasPermission.mockResolvedValue(false);

    const result = await updateTeamMemberRole(
      "team-1",
      "user-2",
      "editor",
      ADMIN,
    );

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a former owner without the platform permission", async () => {
    queueLockedReads("owner", "admin");
    mockHasPermission.mockResolvedValue(false);

    const result = await updateTeamMemberRole("team-1", "user-2", "admin", {
      userId: "admin-1",
      actingRole: "owner",
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockHasPermission).toHaveBeenCalledWith("admin-1", "team:edit_any");
  });

  it("lets a platform admin act as owner without a membership", async () => {
    const updated = {
      id: 2,
      teamId: "team-1",
      userId: "user-2",
      role: "admin",
    };
    queueLockedReads("owner", null);
    mockHasPermission.mockResolvedValue(true);
    mockTxUpdateReturning.mockResolvedValueOnce([updated]);

    const result = await updateTeamMemberRole("team-1", "user-2", "admin", {
      userId: "platform-admin",
      actingRole: "owner",
    });

    expect(result).toEqual({ ok: true, member: updated });
  });

  it("allows an admin to change a non-owner role", async () => {
    const updated = {
      id: 2,
      teamId: "team-1",
      userId: "user-2",
      role: "editor",
    };
    queueLockedReads("viewer", "admin");
    mockTxUpdateReturning.mockResolvedValueOnce([updated]);

    const result = await updateTeamMemberRole(
      "team-1",
      "user-2",
      "editor",
      ADMIN,
    );

    expect(result).toEqual({ ok: true, member: updated });
    expect(mockHasPermission).not.toHaveBeenCalled();
  });

  it("uses the locked target role when an owner changes their own role", async () => {
    const updated = {
      id: 1,
      teamId: "team-1",
      userId: "owner-1",
      role: "admin",
    };
    // No separate actor read: actor and target are the same row
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }, { userId: "owner-2" }]))
      .mockReturnValueOnce(rows([{ role: "owner" }]));
    mockTxUpdateReturning.mockResolvedValueOnce([updated]);

    const result = await updateTeamMemberRole("team-1", "owner-1", "admin", {
      userId: "owner-1",
      actingRole: "owner",
    });

    expect(result).toEqual({ ok: true, member: updated });
    expect(mockTxWhere).toHaveBeenCalledTimes(2);
    expect(mockHasPermission).not.toHaveBeenCalled();
  });

  it("rejects a self-promotion based on a stale acting role", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }]))
      .mockReturnValueOnce(rows([{ role: "admin" }]));

    const result = await updateTeamMemberRole(
      "team-1",
      "admin-1",
      "owner",
      ADMIN,
    );

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});

describe("removeTeamMember", () => {
  it("refuses to remove the last owner", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }]))
      .mockReturnValueOnce(rows([{ role: "owner" }]));

    const result = await removeTeamMember("team-1", "owner-1");

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it("removes an owner when another owner remains and logs the event", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }, { userId: "owner-2" }]))
      .mockReturnValueOnce(rows([{ role: "owner" }]));

    const result = await removeTeamMember("team-1", "owner-1");

    expect(result).toEqual({ ok: true });
    expect(mockTxDelete).toHaveBeenCalledWith(teamMembers);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "team_member_removed",
        userId: "owner-1",
        entityId: "team-1",
        entityType: "team",
      }),
    );
  });

  it("returns 404 when the user is not a member", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }]))
      .mockReturnValueOnce(rows([]));

    const result = await removeTeamMember("team-1", "ghost");

    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it("rejects an admin removing a target that became owner concurrently", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }, { userId: "user-2" }]))
      .mockReturnValueOnce(rows([{ role: "owner" }]))
      .mockReturnValueOnce(rows([{ role: "admin" }]));

    const result = await removeTeamMember("team-1", "user-2", {
      userId: "admin-1",
      actingRole: "admin",
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it("lets an admin remove a non-owner", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }]))
      .mockReturnValueOnce(rows([{ role: "editor" }]))
      .mockReturnValueOnce(rows([{ role: "admin" }]));

    const result = await removeTeamMember("team-1", "user-2", {
      userId: "admin-1",
      actingRole: "admin",
    });

    expect(result).toEqual({ ok: true });
    expect(mockTxDelete).toHaveBeenCalledWith(teamMembers);
  });

  it("always lets a member leave, even as the actor", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ userId: "owner-1" }]))
      .mockReturnValueOnce(rows([{ role: "viewer" }]));

    const result = await removeTeamMember("team-1", "user-2", {
      userId: "user-2",
      actingRole: "viewer",
    });

    expect(result).toEqual({ ok: true });
    expect(mockTxWhere).toHaveBeenCalledTimes(2);
  });
});

describe("join link settings", () => {
  it("enableOrRotateJoinLink sets a fresh token", async () => {
    mockUpdateReturning.mockImplementationOnce(async () => [
      { joinToken: mockUpdateSet.mock.calls[0][0].joinToken },
    ]);

    const token = await enableOrRotateJoinLink("team-1");

    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("enableOrRotateJoinLink returns null for a missing team", async () => {
    mockUpdateReturning.mockResolvedValueOnce([]);
    await expect(enableOrRotateJoinLink("missing")).resolves.toBeNull();
  });

  it("disableJoinLink clears the token", async () => {
    mockUpdateReturning.mockResolvedValueOnce([{ id: "team-1" }]);

    await expect(disableJoinLink("team-1")).resolves.toBe(true);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ joinToken: null }),
    );
  });

  it("setJoinLinkRole updates the join role", async () => {
    mockUpdateReturning.mockResolvedValueOnce([{ id: "team-1" }]);

    await expect(setJoinLinkRole("team-1", "editor")).resolves.toBe(true);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ joinRole: "editor" }),
    );
  });
});

describe("joinTeamByToken", () => {
  const TOKEN = "a".repeat(32);

  it("rejects when the join link is disabled", async () => {
    mockTxWhere.mockReturnValueOnce(
      rows([{ joinToken: null, joinRole: "viewer" }]),
    );

    const result = await joinTeamByToken("team-1", "user-1", TOKEN);

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Invalid join link",
    });
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it("rejects a wrong token of the same length", async () => {
    mockTxWhere.mockReturnValueOnce(
      rows([{ joinToken: TOKEN, joinRole: "viewer" }]),
    );

    const result = await joinTeamByToken("team-1", "user-1", "b".repeat(32));

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Invalid join link",
    });
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it("rejects a wrong token of a different length", async () => {
    mockTxWhere.mockReturnValueOnce(
      rows([{ joinToken: TOKEN, joinRole: "viewer" }]),
    );

    const result = await joinTeamByToken("team-1", "user-1", "short");

    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it("returns the same 404 for a missing team", async () => {
    mockTxWhere.mockReturnValueOnce(rows([]));

    const result = await joinTeamByToken("missing", "user-1", TOKEN);

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Invalid join link",
    });
  });

  it("never downgrades an existing member", async () => {
    const existing = {
      id: 1,
      teamId: "team-1",
      userId: "user-1",
      role: "owner",
      joinedAt: new Date(),
    };
    mockTxWhere
      .mockReturnValueOnce(rows([{ joinToken: TOKEN, joinRole: "viewer" }]))
      .mockReturnValueOnce(rows([existing]));
    mockTxInsertReturning.mockResolvedValueOnce([]);

    const result = await joinTeamByToken("team-1", "user-1", TOKEN);

    expect(result).toEqual({ ok: true, member: existing, alreadyMember: true });
    expect(mockTxOnConflictDoNothing).toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it("adds a new member with the join role, clears invitations and logs", async () => {
    const inserted = {
      id: 2,
      teamId: "team-1",
      userId: "user-1",
      role: "incrementer",
      joinedAt: new Date(),
    };
    mockTxWhere.mockReturnValueOnce(
      rows([{ joinToken: TOKEN, joinRole: "incrementer" }]),
    );
    mockTxInsertReturning.mockResolvedValueOnce([inserted]);

    const result = await joinTeamByToken("team-1", "user-1", TOKEN);

    expect(result).toEqual({
      ok: true,
      member: inserted,
      alreadyMember: false,
    });
    expect(mockTxInsertValues).toHaveBeenCalledWith({
      teamId: "team-1",
      userId: "user-1",
      role: "incrementer",
    });
    expect(mockTxDelete).toHaveBeenCalledWith(teamInvitations);
    expect(mockLogEvent).toHaveBeenCalledWith({
      eventType: "team_member_added",
      userId: "user-1",
      entityId: "team-1",
      entityType: "team",
      metadata: { via: "join_link" },
    });
  });
});
