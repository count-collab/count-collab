import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockInnerJoin,
  mockLeftJoin,
  mockInsert,
  mockInsertValues,
  mockInsertOnConflictDoUpdate,
  mockInsertReturning,
  mockUpdate,
  mockUpdateSet,
  mockUpdateWhere,
  mockUpdateReturning,
  mockDelete,
  mockDeleteWhere,
  mockDeleteReturning,
  mockTxSelect,
  mockTxFrom,
  mockTxWhere,
  mockTxInsert,
  mockTxInsertValues,
  mockTxInsertOnConflictDoUpdate,
  mockTxInsertReturning,
  mockTxDelete,
  mockTxDeleteWhere,
  mockTransaction,
  mockAs,
  mockTxUpdate,
  mockTxUpdateSet,
  mockTxUpdateWhere,
  mockTxUpdateReturning,
  mockLogEvent,
  mockEmitInvitationCreated,
} = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockInnerJoin = vi.fn();
  const mockLeftJoin = vi.fn();
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
  const mockTxSelect = vi.fn();
  const mockTxFrom = vi.fn();
  const mockTxWhere = vi.fn();
  const mockTxInsert = vi.fn();
  const mockTxInsertValues = vi.fn();
  const mockTxInsertOnConflictDoUpdate = vi.fn();
  const mockTxInsertReturning = vi.fn();
  const mockTxDelete = vi.fn();
  const mockTxDeleteWhere = vi.fn();
  const mockTransaction = vi.fn();
  const mockAs = vi
    .fn()
    .mockReturnValue({ id: "inviter.id", username: "inviter.username" });
  const mockTxUpdate = vi.fn();
  const mockTxUpdateSet = vi.fn();
  const mockTxUpdateWhere = vi.fn();
  const mockTxUpdateReturning = vi.fn();
  const mockLogEvent = vi.fn();
  const mockEmitInvitationCreated = vi.fn();

  // Set up chains so module-level db.select().from().as() works at import time
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({
    innerJoin: mockInnerJoin,
    where: mockWhere,
    as: mockAs,
  });
  mockInnerJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
  mockLeftJoin.mockReturnValue({ where: mockWhere });
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

  return {
    mockSelect,
    mockFrom,
    mockWhere,
    mockInnerJoin,
    mockLeftJoin,
    mockInsert,
    mockInsertValues,
    mockInsertOnConflictDoUpdate,
    mockInsertReturning,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockUpdateReturning,
    mockDelete,
    mockDeleteWhere,
    mockDeleteReturning,
    mockTxSelect,
    mockTxFrom,
    mockTxWhere,
    mockTxInsert,
    mockTxInsertValues,
    mockTxInsertOnConflictDoUpdate,
    mockTxInsertReturning,
    mockTxDelete,
    mockTxDeleteWhere,
    mockTransaction,
    mockAs,
    mockTxUpdate,
    mockTxUpdateSet,
    mockTxUpdateWhere,
    mockTxUpdateReturning,
    mockLogEvent,
    mockEmitInvitationCreated,
  };
});

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("$lib/server/events", () => ({
  logEvent: mockLogEvent,
}));

vi.mock("$lib/utils/socket", () => ({
  emitInvitationCreated: mockEmitInvitationCreated,
}));

function setupChains() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({
    innerJoin: mockInnerJoin,
    where: mockWhere,
    as: mockAs,
  });
  mockInnerJoin.mockReturnValue({
    innerJoin: mockInnerJoin,
    leftJoin: mockLeftJoin,
    where: mockWhere,
  });
  mockLeftJoin.mockReturnValue({ where: mockWhere });
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
}

const mockTxInsertOnConflictDoNothing = vi.fn();

function setupTxChains() {
  mockTxSelect.mockReturnValue({ from: mockTxFrom });
  mockTxFrom.mockReturnValue({ where: mockTxWhere });
  mockTxInsert.mockReturnValue({ values: mockTxInsertValues });
  mockTxInsertValues.mockReturnValue({
    onConflictDoUpdate: mockTxInsertOnConflictDoUpdate,
    onConflictDoNothing: mockTxInsertOnConflictDoNothing,
    returning: mockTxInsertReturning,
  });
  mockTxInsertOnConflictDoUpdate.mockReturnValue({
    returning: mockTxInsertReturning,
  });
  mockTxInsertOnConflictDoNothing.mockReturnValue({
    returning: mockTxInsertReturning,
  });
  mockTxDelete.mockReturnValue({ where: mockTxDeleteWhere });
  mockTxUpdate.mockReturnValue({ set: mockTxUpdateSet });
  mockTxUpdateSet.mockReturnValue({ where: mockTxUpdateWhere });
  mockTxUpdateWhere.mockReturnValue({ returning: mockTxUpdateReturning });
}

const tx = {
  select: (...args: unknown[]) => mockTxSelect(...args),
  insert: (...args: unknown[]) => mockTxInsert(...args),
  update: (...args: unknown[]) => mockTxUpdate(...args),
  delete: (...args: unknown[]) => mockTxDelete(...args),
};

/** Query result that can be awaited directly or after `.for(...)`. */
function rows<T>(data: T[]) {
  return Object.assign(Promise.resolve(data), {
    for: () => Promise.resolve(data),
  });
}

import {
  acceptCounterInvitation,
  acceptTeamInvitation,
  createCounterInvitation,
  createTeamInvitation,
  deleteCounterInvitation,
  deleteTeamInvitation,
  getCounterInvitations,
  getTeamInvitations,
  getUserPendingInvitationCount,
  getUserPendingInvitations,
  hasCounterPendingInvitation,
  updateCounterInvitationRole,
  updateTeamInvitationRole,
} from "./invitations";

const mockInvitation = {
  id: "inv-1",
  counterId: "counter-1",
  userId: "user-1",
  invitedBy: "owner-1",
  role: "editor" as const,
  createdAt: new Date("2024-01-01"),
};

const mockInvitationWithUser = {
  ...mockInvitation,
  username: "alice",
  name: "Alice",
  image: null,
  inviterUsername: "bob",
};

describe("createCounterInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("creates an invitation and returns it with user details", async () => {
    mockInsertReturning.mockResolvedValueOnce([mockInvitation]);
    mockWhere.mockResolvedValueOnce([mockInvitationWithUser]);

    const result = await createCounterInvitation(
      "counter-1",
      "user-1",
      "editor",
      "owner-1",
    );

    expect(result).toEqual(mockInvitationWithUser);
    expect(mockInsertValues).toHaveBeenCalledWith({
      counterId: "counter-1",
      userId: "user-1",
      role: "editor",
      invitedBy: "owner-1",
    });
  });

  it("returns null when insert returns empty", async () => {
    mockInsertReturning.mockResolvedValueOnce([]);

    const result = await createCounterInvitation(
      "counter-1",
      "user-1",
      "editor",
      "owner-1",
    );

    expect(result).toBeNull();
  });

  it("returns null when user join query returns empty", async () => {
    mockInsertReturning.mockResolvedValueOnce([mockInvitation]);
    mockWhere.mockResolvedValueOnce([]);

    const result = await createCounterInvitation(
      "counter-1",
      "user-1",
      "editor",
      "owner-1",
    );

    expect(result).toBeNull();
  });
});

describe("deleteCounterInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns true when invitation is deleted", async () => {
    mockDeleteReturning.mockResolvedValueOnce([mockInvitation]);

    const result = await deleteCounterInvitation("counter-1", "user-1");

    expect(result).toBe(true);
  });

  it("returns false when invitation not found", async () => {
    mockDeleteReturning.mockResolvedValueOnce([]);

    const result = await deleteCounterInvitation("counter-1", "user-1");

    expect(result).toBe(false);
  });
});

describe("updateCounterInvitationRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("updates role and returns invitation with user details", async () => {
    mockUpdateReturning.mockResolvedValueOnce([mockInvitation]);
    mockWhere.mockResolvedValueOnce([mockInvitationWithUser]);

    const result = await updateCounterInvitationRole(
      "counter-1",
      "user-1",
      "admin",
    );

    expect(result).toEqual(mockInvitationWithUser);
    expect(mockUpdateSet).toHaveBeenCalledWith({ role: "admin" });
  });

  it("returns null when invitation not found", async () => {
    mockUpdateReturning.mockResolvedValueOnce([]);

    const result = await updateCounterInvitationRole(
      "counter-1",
      "user-1",
      "admin",
    );

    expect(result).toBeNull();
  });

  it("returns null when user join returns empty", async () => {
    mockUpdateReturning.mockResolvedValueOnce([mockInvitation]);
    mockWhere.mockResolvedValueOnce([]);

    const result = await updateCounterInvitationRole(
      "counter-1",
      "user-1",
      "admin",
    );

    expect(result).toBeNull();
  });
});

describe("getCounterInvitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns invitations with user details", async () => {
    mockWhere.mockResolvedValueOnce([mockInvitationWithUser]);

    const result = await getCounterInvitations("counter-1");

    expect(result).toEqual([mockInvitationWithUser]);
  });

  it("returns empty array when no invitations exist", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const result = await getCounterInvitations("counter-1");

    expect(result).toEqual([]);
  });
});

describe("acceptCounterInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
    setupTxChains();
    mockTransaction.mockImplementation(async (fn: (tx: any) => unknown) =>
      fn(tx),
    );
  });

  it("accepts invitation: inserts member and deletes invitation", async () => {
    const invitation = {
      id: "inv-1",
      counterId: "counter-1",
      userId: "user-1",
      role: "editor",
    };
    const member = {
      id: 1,
      counterId: "counter-1",
      userId: "user-1",
      role: "editor",
    };

    mockTxWhere.mockResolvedValueOnce([invitation]);
    mockTxInsertReturning.mockResolvedValueOnce([member]);
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);

    const result = await acceptCounterInvitation("counter-1", "user-1");

    expect(result).toEqual(member);
    expect(mockTxInsertValues).toHaveBeenCalledWith({
      counterId: "counter-1",
      userId: "user-1",
      role: "editor",
    });
    expect(mockTxDelete).toHaveBeenCalledOnce();
  });

  it("returns null when invitation not found", async () => {
    mockTxWhere.mockResolvedValueOnce([]);

    const result = await acceptCounterInvitation("counter-1", "user-1");

    expect(result).toBeNull();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });
});

describe("hasCounterPendingInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns true when invitation exists", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "inv-1" }]);

    const result = await hasCounterPendingInvitation("counter-1", "user-1");

    expect(result).toBe(true);
  });

  it("returns false when no invitation exists", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const result = await hasCounterPendingInvitation("counter-1", "user-1");

    expect(result).toBe(false);
  });
});

describe("getUserPendingInvitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns combined counter and dashboard invitations", async () => {
    const counterInv = {
      id: "inv-1",
      counterId: "counter-1",
      userId: "user-1",
      invitedBy: "owner-1",
      role: "editor",
      createdAt: new Date(),
      title: "My Counter",
      inviterUsername: "bob",
    };
    const dashboardInv = {
      id: "inv-2",
      dashboardId: "dash-1",
      userId: "user-1",
      invitedBy: "owner-2",
      role: "viewer",
      createdAt: new Date(),
      title: "My Dashboard",
      inviterUsername: "carol",
    };
    const teamInv = {
      id: "inv-3",
      teamId: "team-1",
      userId: "user-1",
      invitedBy: "owner-3",
      role: "admin",
      createdAt: new Date(),
      title: "My Team",
      inviterUsername: "dave",
    };

    // First query: counter invitations (select → from → innerJoin → leftJoin → where)
    mockWhere.mockResolvedValueOnce([counterInv]);
    // Second query: dashboard invitations (select → from → innerJoin → leftJoin → where)
    mockWhere.mockResolvedValueOnce([dashboardInv]);
    // Third query: team invitations
    mockWhere.mockResolvedValueOnce([teamInv]);

    const result = await getUserPendingInvitations("user-1");

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      type: "counter",
      resourceId: "counter-1",
    });
    expect(result[1]).toMatchObject({
      type: "dashboard",
      resourceId: "dash-1",
    });
    expect(result[2]).toMatchObject({
      type: "team",
      resourceId: "team-1",
      title: "My Team",
    });
  });

  it("returns empty array when no invitations", async () => {
    mockWhere.mockResolvedValueOnce([]);
    mockWhere.mockResolvedValueOnce([]);
    mockWhere.mockResolvedValueOnce([]);

    const result = await getUserPendingInvitations("user-1");

    expect(result).toEqual([]);
  });
});

describe("getUserPendingInvitationCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns combined count of counter, dashboard and team invitations", async () => {
    mockWhere.mockResolvedValueOnce([{ count: 3 }]);
    mockWhere.mockResolvedValueOnce([{ count: 2 }]);
    mockWhere.mockResolvedValueOnce([{ count: 1 }]);

    const result = await getUserPendingInvitationCount("user-1");

    expect(result).toBe(6);
  });

  it("returns 0 when no invitations", async () => {
    mockWhere.mockResolvedValueOnce([{ count: 0 }]);
    mockWhere.mockResolvedValueOnce([{ count: 0 }]);
    mockWhere.mockResolvedValueOnce([{ count: 0 }]);

    const result = await getUserPendingInvitationCount("user-1");

    expect(result).toBe(0);
  });

  it("handles undefined rows gracefully", async () => {
    mockWhere.mockResolvedValueOnce([]);
    mockWhere.mockResolvedValueOnce([]);
    mockWhere.mockResolvedValueOnce([]);

    const result = await getUserPendingInvitationCount("user-1");

    expect(result).toBe(0);
  });
});

const mockTeamInvitation = {
  id: 10,
  teamId: "team-1",
  userId: "user-1",
  invitedBy: "owner-1",
  role: "editor" as const,
  createdAt: new Date("2024-01-01"),
};

const mockTeamInvitationWithUser = {
  ...mockTeamInvitation,
  username: "alice",
  name: "Alice",
  image: null,
  inviterUsername: "bob",
};

describe("createTeamInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("creates the invitation, logs it and emits a socket event", async () => {
    mockInsertReturning.mockResolvedValueOnce([mockTeamInvitation]);
    mockWhere.mockResolvedValueOnce([
      { ...mockTeamInvitationWithUser, teamName: "Alpha" },
    ]);

    const result = await createTeamInvitation(
      "team-1",
      "user-1",
      "editor",
      "owner-1",
    );

    expect(result).toEqual(mockTeamInvitationWithUser);
    expect(mockInsertValues).toHaveBeenCalledWith({
      teamId: "team-1",
      userId: "user-1",
      role: "editor",
      invitedBy: "owner-1",
    });
    expect(mockEmitInvitationCreated).toHaveBeenCalledWith("user-1", {
      type: "team",
      entityId: "team-1",
      entityTitle: "Alpha",
      role: "editor",
      inviterUsername: "bob",
    });
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "invitation_sent",
        metadata: expect.objectContaining({ target_type: "team" }),
      }),
    );
  });

  it("returns null without emitting when insert returns empty", async () => {
    mockInsertReturning.mockResolvedValueOnce([]);

    const result = await createTeamInvitation(
      "team-1",
      "user-1",
      "editor",
      "owner-1",
    );

    expect(result).toBeNull();
    expect(mockEmitInvitationCreated).not.toHaveBeenCalled();
  });
});

describe("deleteTeamInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns true and logs when deleted", async () => {
    mockDeleteReturning.mockResolvedValueOnce([mockTeamInvitation]);

    await expect(deleteTeamInvitation("team-1", "user-1")).resolves.toBe(true);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "invitation_deleted",
        metadata: { target_type: "team" },
      }),
    );
  });

  it("returns false when not found", async () => {
    mockDeleteReturning.mockResolvedValueOnce([]);

    await expect(deleteTeamInvitation("team-1", "user-1")).resolves.toBe(false);
    expect(mockLogEvent).not.toHaveBeenCalled();
  });
});

describe("updateTeamInvitationRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("updates role and returns invitation with user details", async () => {
    mockUpdateReturning.mockResolvedValueOnce([mockTeamInvitation]);
    mockWhere.mockResolvedValueOnce([mockTeamInvitationWithUser]);

    const result = await updateTeamInvitationRole("team-1", "user-1", "admin");

    expect(result).toEqual(mockTeamInvitationWithUser);
    expect(mockUpdateSet).toHaveBeenCalledWith({ role: "admin" });
  });

  it("returns null when invitation not found", async () => {
    mockUpdateReturning.mockResolvedValueOnce([]);

    await expect(
      updateTeamInvitationRole("team-1", "user-1", "admin"),
    ).resolves.toBeNull();
  });
});

describe("getTeamInvitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns invitations with user details", async () => {
    mockWhere.mockResolvedValueOnce([mockTeamInvitationWithUser]);

    await expect(getTeamInvitations("team-1")).resolves.toEqual([
      mockTeamInvitationWithUser,
    ]);
  });
});

describe("acceptTeamInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
    setupTxChains();
    mockTransaction.mockImplementation(async (fn: (tx: any) => unknown) =>
      fn(tx),
    );
  });

  it("inserts a membership, deletes the invitation and logs both events", async () => {
    const member = {
      id: 1,
      teamId: "team-1",
      userId: "user-1",
      role: "editor",
    };
    mockTxWhere
      .mockReturnValueOnce(rows([{ id: "team-1" }]))
      .mockReturnValueOnce(rows([mockTeamInvitation]))
      .mockReturnValueOnce(rows([]));
    mockTxInsertReturning.mockResolvedValueOnce([member]);
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);

    const result = await acceptTeamInvitation("team-1", "user-1");

    expect(result).toEqual(member);
    expect(mockTxInsertValues).toHaveBeenCalledWith({
      teamId: "team-1",
      userId: "user-1",
      role: "editor",
    });
    expect(mockTxDelete).toHaveBeenCalledOnce();
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "invitation_accepted" }),
    );
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "team_member_added" }),
    );
  });

  it("does not downgrade an existing higher-ranked member", async () => {
    const existing = {
      id: 1,
      teamId: "team-1",
      userId: "user-1",
      role: "owner",
    };
    mockTxWhere
      .mockReturnValueOnce(rows([{ id: "team-1" }]))
      .mockReturnValueOnce(rows([mockTeamInvitation]))
      .mockReturnValueOnce(rows([existing]));
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);

    const result = await acceptTeamInvitation("team-1", "user-1");

    expect(result).toEqual(existing);
    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxDelete).toHaveBeenCalledOnce();
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "team_member_added" }),
    );
  });

  it("upgrades an existing lower-ranked member", async () => {
    const existing = {
      id: 1,
      teamId: "team-1",
      userId: "user-1",
      role: "viewer",
    };
    const upgraded = { ...existing, role: "editor" };
    mockTxWhere
      .mockReturnValueOnce(rows([{ id: "team-1" }]))
      .mockReturnValueOnce(rows([mockTeamInvitation]))
      .mockReturnValueOnce(rows([existing]));
    mockTxUpdateReturning.mockResolvedValueOnce([upgraded]);
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);

    const result = await acceptTeamInvitation("team-1", "user-1");

    expect(result).toEqual(upgraded);
    expect(mockTxUpdateSet).toHaveBeenCalledWith({ role: "editor" });
  });

  it("returns null when invitation not found", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ id: "team-1" }]))
      .mockReturnValueOnce(rows([]));

    await expect(acceptTeamInvitation("team-1", "user-1")).resolves.toBeNull();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it("returns null when the team is gone", async () => {
    mockTxWhere.mockReturnValueOnce(rows([]));

    await expect(acceptTeamInvitation("team-1", "user-1")).resolves.toBeNull();
    expect(mockTxWhere).toHaveBeenCalledOnce();
    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it("share-locks the team and update-locks the invitation", async () => {
    const teamFor = vi.fn().mockResolvedValue([{ id: "team-1" }]);
    const invitationFor = vi.fn().mockResolvedValue([]);
    mockTxWhere
      .mockReturnValueOnce({ for: teamFor })
      .mockReturnValueOnce({ for: invitationFor });

    await acceptTeamInvitation("team-1", "user-1");

    expect(teamFor).toHaveBeenCalledWith("share");
    expect(invitationFor).toHaveBeenCalledWith("update");
  });

  it("upgrades a membership created concurrently instead of throwing on the unique conflict", async () => {
    const concurrent = {
      id: 1,
      teamId: "team-1",
      userId: "user-1",
      role: "viewer",
    };
    const upgraded = { ...concurrent, role: "editor" };
    mockTxWhere
      .mockReturnValueOnce(rows([{ id: "team-1" }]))
      .mockReturnValueOnce(rows([mockTeamInvitation]))
      .mockReturnValueOnce(rows([]))
      .mockReturnValueOnce(rows([concurrent]));
    // ON CONFLICT DO NOTHING returns no row
    mockTxInsertReturning.mockResolvedValueOnce([]);
    mockTxUpdateReturning.mockResolvedValueOnce([upgraded]);
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);

    const result = await acceptTeamInvitation("team-1", "user-1");

    expect(result).toEqual(upgraded);
    expect(mockTxInsertOnConflictDoNothing).toHaveBeenCalledOnce();
    expect(mockTxUpdateSet).toHaveBeenCalledWith({ role: "editor" });
    expect(mockTxDelete).toHaveBeenCalledOnce();
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "team_member_added" }),
    );
  });

  it("never downgrades a membership created concurrently", async () => {
    const concurrent = {
      id: 1,
      teamId: "team-1",
      userId: "user-1",
      role: "admin",
    };
    mockTxWhere
      .mockReturnValueOnce(rows([{ id: "team-1" }]))
      .mockReturnValueOnce(rows([mockTeamInvitation]))
      .mockReturnValueOnce(rows([]))
      .mockReturnValueOnce(rows([concurrent]));
    mockTxInsertReturning.mockResolvedValueOnce([]);
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);

    const result = await acceptTeamInvitation("team-1", "user-1");

    expect(result).toEqual(concurrent);
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxDelete).toHaveBeenCalledOnce();
  });

  it("returns null when the conflicting membership disappeared again", async () => {
    mockTxWhere
      .mockReturnValueOnce(rows([{ id: "team-1" }]))
      .mockReturnValueOnce(rows([mockTeamInvitation]))
      .mockReturnValueOnce(rows([]))
      .mockReturnValueOnce(rows([]));
    mockTxInsertReturning.mockResolvedValueOnce([]);

    await expect(acceptTeamInvitation("team-1", "user-1")).resolves.toBeNull();
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });
});
