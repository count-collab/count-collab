import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLogEventInTx, mockHasPermission, mockEnforceMemberCap } =
  vi.hoisted(() => ({
    mockLogEventInTx: vi.fn(),
    mockHasPermission: vi.fn(),
    mockEnforceMemberCap: vi.fn(),
  }));

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
  logEventInTx: mockLogEventInTx,
}));

vi.mock("$lib/server/permissions", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("$lib/server/teams", async (importOriginal) => ({
  ...(await importOriginal<typeof import("$lib/server/teams")>()),
  enforceMemberCap: mockEnforceMemberCap,
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
import { TeamLimitError } from "./team-limits";
import {
  INVITATION_COOLDOWN_SECONDS,
  INVITATION_EXPIRY_MS,
  MAX_INVITATIONS_PER_INVITER_PER_DAY,
  MAX_PENDING_INVITATIONS_PER_TEAM,
  MAX_PENDING_INVITATIONS_PER_USER,
} from "./teams";

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

const ago = (ms: number) => new Date(Date.now() - ms);

const mockTeamInvitation = {
  id: 10,
  teamId: "team-1",
  userId: "user-1",
  invitedBy: "owner-1",
  role: "editor" as const,
  createdAt: ago(60 * 60 * 1000),
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
    setupTxChains();
    mockTxWhere.mockReset();
    mockTxInsertReturning.mockReset();
    mockWhere.mockReset();
    mockTransaction.mockImplementation(async (fn: (tx: any) => unknown) =>
      fn(tx),
    );
  });

  /**
   * Queues the transaction's reads in order; stages left undefined are not
   * queued because the function is expected to have thrown before them.
   */
  function queueChecks(o: {
    team?: boolean;
    existing?: { createdAt: Date; role?: string } | null;
    forTeam?: number;
    forUser?: number;
    sentToday?: number;
  }) {
    mockTxWhere.mockReturnValueOnce(
      rows(o.team === false ? [] : [{ id: "team-1" }]),
    );
    if (o.team === false) return;
    mockTxWhere.mockReturnValueOnce(rows([{ id: "owner-1" }]));
    mockTxWhere.mockReturnValueOnce(
      rows(o.existing ? [{ ...mockTeamInvitation, ...o.existing }] : []),
    );
    if (o.forTeam !== undefined) {
      mockTxWhere.mockReturnValueOnce(rows([{ total: o.forTeam }]));
    }
    if (o.forUser !== undefined) {
      mockTxWhere.mockReturnValueOnce(rows([{ total: o.forUser }]));
    }
    if (o.sentToday !== undefined) {
      mockTxWhere.mockReturnValueOnce(rows([{ total: o.sentToday }]));
    }
  }

  function queueCreated() {
    mockTxInsertReturning.mockResolvedValueOnce([mockTeamInvitation]);
    mockWhere.mockResolvedValueOnce([
      { ...mockTeamInvitationWithUser, teamName: "Alpha" },
    ]);
  }

  const invite = (role: "editor" | "admin" = "editor") =>
    createTeamInvitation("team-1", "user-1", role, "owner-1");

  const freshCaps = { forTeam: 0, forUser: 0, sentToday: 0 };

  it("creates the invitation, logs it and emits a socket event", async () => {
    queueChecks({ existing: null, ...freshCaps });
    queueCreated();

    const result = await invite();

    expect(result).toEqual(mockTeamInvitationWithUser);
    expect(mockTxInsertValues).toHaveBeenCalledWith({
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
    expect(mockLogEventInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: "invitation_sent",
        userId: "owner-1",
        metadata: expect.objectContaining({ target_type: "team" }),
      }),
    );
  });

  it("refreshes createdAt on re-invite so expiry and cooldown restart", async () => {
    queueChecks({ existing: null, ...freshCaps });
    queueCreated();

    await invite();

    expect(mockTxInsertOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: {
          role: "editor",
          invitedBy: "owner-1",
          createdAt: expect.any(Date),
        },
      }),
    );
  });

  it("locks the team row before reading anything else", async () => {
    const teamFor = vi.fn().mockResolvedValue([{ id: "team-1" }]);
    mockTxWhere.mockReturnValueOnce({ for: teamFor });
    mockTxWhere.mockReturnValueOnce(rows([{ id: "owner-1" }]));
    mockTxWhere.mockReturnValueOnce(rows([]));
    mockTxWhere.mockReturnValueOnce(rows([{ total: 0 }]));
    mockTxWhere.mockReturnValueOnce(rows([{ total: 0 }]));
    mockTxWhere.mockReturnValueOnce(rows([{ total: 0 }]));
    queueCreated();

    await invite();

    expect(teamFor).toHaveBeenCalledWith("update");
    expect(teamFor.mock.invocationCallOrder[0]).toBeLessThan(
      mockTxWhere.mock.invocationCallOrder[1],
    );
  });

  it("returns null without writing when the team is gone", async () => {
    queueChecks({ team: false });

    await expect(invite()).resolves.toBeNull();

    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockEmitInvitationCreated).not.toHaveBeenCalled();
  });

  it("returns null without emitting when insert returns empty", async () => {
    queueChecks({ existing: null, ...freshCaps });
    mockTxInsertReturning.mockResolvedValueOnce([]);

    await expect(invite()).resolves.toBeNull();

    expect(mockEmitInvitationCreated).not.toHaveBeenCalled();
    expect(mockLogEventInTx).not.toHaveBeenCalled();
  });

  it("allows the last invitation below every cap", async () => {
    queueChecks({
      existing: null,
      forTeam: MAX_PENDING_INVITATIONS_PER_TEAM - 1,
      forUser: MAX_PENDING_INVITATIONS_PER_USER - 1,
      sentToday: MAX_INVITATIONS_PER_INVITER_PER_DAY - 1,
    });
    queueCreated();

    await expect(invite()).resolves.toEqual(mockTeamInvitationWithUser);
  });

  describe("re-invite cooldown", () => {
    it("rejects with 429 and retryAfter while the invitation is younger than the cooldown", async () => {
      queueChecks({ existing: { createdAt: ago(10_000) } });

      const error = await invite().catch((e) => e);

      expect(error).toBeInstanceOf(TeamLimitError);
      expect(error).toMatchObject({
        code: "invitation_cooldown",
        status: 429,
      });
      expect(error.retryAfter).toBeGreaterThanOrEqual(
        INVITATION_COOLDOWN_SECONDS - 11,
      );
      expect(error.retryAfter).toBeLessThanOrEqual(
        INVITATION_COOLDOWN_SECONDS - 9,
      );
      expect(mockTxInsert).not.toHaveBeenCalled();
      expect(mockEmitInvitationCreated).not.toHaveBeenCalled();
    });

    it("still applies when the re-invite changes the role", async () => {
      queueChecks({ existing: { createdAt: ago(1_000), role: "viewer" } });

      await expect(invite("admin")).rejects.toMatchObject({
        code: "invitation_cooldown",
      });
      expect(mockTxInsert).not.toHaveBeenCalled();
    });

    it("allows a re-invite after the cooldown and skips the pending-count caps", async () => {
      queueChecks({
        existing: { createdAt: ago((INVITATION_COOLDOWN_SECONDS + 1) * 1000) },
        sentToday: 0,
      });
      queueCreated();

      await expect(invite("admin")).resolves.toEqual(
        mockTeamInvitationWithUser,
      );
      // team, inviter, existing, daily
      expect(mockTxWhere).toHaveBeenCalledTimes(4);
    });

    it("treats an expired invitation as new and checks the pending caps", async () => {
      queueChecks({
        existing: { createdAt: ago(INVITATION_EXPIRY_MS + 1_000) },
        ...freshCaps,
      });
      queueCreated();

      await invite();

      expect(mockTxWhere).toHaveBeenCalledTimes(6);
    });
  });

  describe("caps", () => {
    it("rejects with 409 at the pending-invitations-per-team cap", async () => {
      queueChecks({ existing: null, forTeam: MAX_PENDING_INVITATIONS_PER_TEAM });

      const error = await invite().catch((e) => e);

      expect(error).toBeInstanceOf(TeamLimitError);
      expect(error).toMatchObject({ code: "pending_team_limit", status: 409 });
      expect(mockTxInsert).not.toHaveBeenCalled();
    });

    it("rejects with 409 at the pending-invitations-per-recipient cap", async () => {
      queueChecks({
        existing: null,
        forTeam: 0,
        forUser: MAX_PENDING_INVITATIONS_PER_USER,
      });

      const error = await invite().catch((e) => e);

      expect(error).toBeInstanceOf(TeamLimitError);
      expect(error).toMatchObject({
        code: "pending_recipient_limit",
        status: 409,
      });
      expect(mockTxInsert).not.toHaveBeenCalled();
    });

    it("rejects with 429 and retryAfter at the per-inviter daily cap", async () => {
      queueChecks({
        existing: null,
        forTeam: 0,
        forUser: 0,
        sentToday: MAX_INVITATIONS_PER_INVITER_PER_DAY,
      });

      const error = await invite().catch((e) => e);

      expect(error).toBeInstanceOf(TeamLimitError);
      expect(error).toMatchObject({
        code: "daily_invitation_limit",
        status: 429,
      });
      expect(error.retryAfter).toBeGreaterThan(0);
      expect(mockTxInsert).not.toHaveBeenCalled();
      expect(mockEmitInvitationCreated).not.toHaveBeenCalled();
    });

    it("applies the daily cap to re-invites of a pending invitation too", async () => {
      queueChecks({
        existing: { createdAt: ago((INVITATION_COOLDOWN_SECONDS + 1) * 1000) },
        sentToday: MAX_INVITATIONS_PER_INVITER_PER_DAY,
      });

      await expect(invite()).rejects.toMatchObject({
        code: "daily_invitation_limit",
      });
    });
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
    mockTxWhere.mockReset();
    mockTxInsertReturning.mockReset();
    mockTxUpdateReturning.mockReset();
    mockTxDeleteWhere.mockReset();
    mockHasPermission.mockReset();
    mockEnforceMemberCap.mockReset();
    mockTransaction.mockImplementation(async (fn: (tx: any) => unknown) =>
      fn(tx),
    );
  });

  /** Queues team, invitation and inviter lookups, then any further reads. */
  function queueAccept(
    later: unknown[][],
    o: {
      invitation?: Record<string, unknown>;
      inviter?: { role: string } | null;
    } = {},
  ) {
    mockTxWhere
      .mockReturnValueOnce(rows([{ id: "team-1" }]))
      .mockReturnValueOnce(rows([{ ...mockTeamInvitation, ...o.invitation }]))
      .mockReturnValueOnce(
        rows(o.inviter === null ? [] : [o.inviter ?? { role: "owner" }]),
      );
    for (const r of later) mockTxWhere.mockReturnValueOnce(rows(r));
  }

  it("inserts a membership, deletes the invitation and logs both events", async () => {
    const member = {
      id: 1,
      teamId: "team-1",
      userId: "user-1",
      role: "editor",
    };
    queueAccept([[]]);
    mockTxInsertReturning.mockResolvedValueOnce([member]);
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);

    const result = await acceptTeamInvitation("team-1", "user-1");

    expect(result).toEqual(member);
    expect(mockEnforceMemberCap).toHaveBeenCalledWith(tx, "team-1");
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
    queueAccept([[existing]]);
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
    queueAccept([[existing]]);
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

  it("update-locks the team and the invitation, share-locks the inviter", async () => {
    const teamFor = vi.fn().mockResolvedValue([{ id: "team-1" }]);
    const invitationFor = vi.fn().mockResolvedValue([]);
    mockTxWhere
      .mockReturnValueOnce({ for: teamFor })
      .mockReturnValueOnce({ for: invitationFor });

    await acceptTeamInvitation("team-1", "user-1");

    expect(teamFor).toHaveBeenCalledWith("update");
    expect(invitationFor).toHaveBeenCalledWith("update");

    const inviterFor = vi.fn().mockResolvedValue([{ role: "owner" }]);
    const memberFor = vi.fn().mockResolvedValue([]);
    mockTxWhere
      .mockReturnValueOnce(rows([{ id: "team-1" }]))
      .mockReturnValueOnce(rows([mockTeamInvitation]))
      .mockReturnValueOnce({ for: inviterFor })
      .mockReturnValueOnce({ for: memberFor });
    mockTxInsertReturning.mockResolvedValueOnce([{ id: 1, role: "editor" }]);

    await acceptTeamInvitation("team-1", "user-1");

    expect(inviterFor).toHaveBeenCalledWith("share");
    expect(memberFor).toHaveBeenCalledWith("update");
  });

  it("upgrades a membership created concurrently instead of throwing on the unique conflict", async () => {
    const concurrent = {
      id: 1,
      teamId: "team-1",
      userId: "user-1",
      role: "viewer",
    };
    const upgraded = { ...concurrent, role: "editor" };
    queueAccept([[], [concurrent]]);
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
    queueAccept([[], [concurrent]]);
    mockTxInsertReturning.mockResolvedValueOnce([]);
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);

    const result = await acceptTeamInvitation("team-1", "user-1");

    expect(result).toEqual(concurrent);
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxDelete).toHaveBeenCalledOnce();
  });

  it("returns null when the conflicting membership disappeared again", async () => {
    queueAccept([[], []]);
    mockTxInsertReturning.mockResolvedValueOnce([]);

    await expect(acceptTeamInvitation("team-1", "user-1")).resolves.toBeNull();
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  describe("inviter re-authorization", () => {
    const expectDiscarded = async () => {
      await expect(
        acceptTeamInvitation("team-1", "user-1"),
      ).resolves.toBeNull();
      expect(mockTxDelete).toHaveBeenCalledOnce();
      expect(mockTxInsert).not.toHaveBeenCalled();
      expect(mockTxUpdate).not.toHaveBeenCalled();
      expect(mockEnforceMemberCap).not.toHaveBeenCalled();
      expect(mockLogEvent).not.toHaveBeenCalled();
    };

    it("deletes the invitation and returns null when the inviter left the team", async () => {
      mockHasPermission.mockResolvedValue(false);
      queueAccept([], { inviter: null });

      await expectDiscarded();
      expect(mockHasPermission).toHaveBeenCalledWith("owner-1", "team:edit_any");
    });

    it("deletes the invitation when the inviter was demoted below admin", async () => {
      queueAccept([], { inviter: { role: "editor" } });

      await expectDiscarded();
    });

    it("deletes the invitation when the inviter's account is gone (invitedBy null)", async () => {
      mockTxWhere
        .mockReturnValueOnce(rows([{ id: "team-1" }]))
        .mockReturnValueOnce(
          rows([{ ...mockTeamInvitation, invitedBy: null }]),
        );

      await expectDiscarded();
      expect(mockHasPermission).not.toHaveBeenCalled();
    });

    it("deletes an owner invitation when the inviter is only an admin", async () => {
      queueAccept([], {
        invitation: { role: "owner" },
        inviter: { role: "admin" },
      });

      await expectDiscarded();
    });

    it("accepts when the inviter is still an admin assigning a non-owner role", async () => {
      queueAccept([[]], {
        invitation: { role: "admin" },
        inviter: { role: "admin" },
      });
      mockTxInsertReturning.mockResolvedValueOnce([{ id: 1, role: "admin" }]);

      await expect(
        acceptTeamInvitation("team-1", "user-1"),
      ).resolves.toMatchObject({ role: "admin" });
    });

    it("accepts when the inviter is a platform admin without membership", async () => {
      mockHasPermission.mockResolvedValue(true);
      queueAccept([[]], { invitation: { role: "owner" }, inviter: null });
      mockTxInsertReturning.mockResolvedValueOnce([{ id: 1, role: "owner" }]);

      await expect(
        acceptTeamInvitation("team-1", "user-1"),
      ).resolves.toMatchObject({ role: "owner" });
    });
  });

  describe("expiry", () => {
    it("deletes an invitation older than 14 days without checking the inviter", async () => {
      mockTxWhere
        .mockReturnValueOnce(rows([{ id: "team-1" }]))
        .mockReturnValueOnce(
          rows([
            {
              ...mockTeamInvitation,
              createdAt: ago(INVITATION_EXPIRY_MS + 1_000),
            },
          ]),
        );

      await expect(
        acceptTeamInvitation("team-1", "user-1"),
      ).resolves.toBeNull();

      expect(mockTxDelete).toHaveBeenCalledOnce();
      expect(mockTxWhere).toHaveBeenCalledTimes(2);
      expect(mockTxInsert).not.toHaveBeenCalled();
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it("accepts an invitation just inside the expiry window", async () => {
      queueAccept([[]], {
        invitation: { createdAt: ago(INVITATION_EXPIRY_MS - 60_000) },
      });
      mockTxInsertReturning.mockResolvedValueOnce([{ id: 1, role: "editor" }]);

      await expect(
        acceptTeamInvitation("team-1", "user-1"),
      ).resolves.toMatchObject({ role: "editor" });
    });
  });

  describe("member cap", () => {
    it("propagates TeamLimitError so the transaction rolls back, without deleting the invitation or logging", async () => {
      mockEnforceMemberCap.mockRejectedValueOnce(
        new TeamLimitError("member_limit", 409, "full"),
      );
      queueAccept([[]]);
      mockTxInsertReturning.mockResolvedValueOnce([{ id: 1, role: "editor" }]);

      await expect(
        acceptTeamInvitation("team-1", "user-1"),
      ).rejects.toMatchObject({ code: "member_limit", status: 409 });

      expect(mockTxDelete).not.toHaveBeenCalled();
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it("does not count against the cap for an existing member", async () => {
      queueAccept([[{ id: 1, teamId: "team-1", userId: "user-1", role: "admin" }]]);

      await acceptTeamInvitation("team-1", "user-1");

      expect(mockEnforceMemberCap).not.toHaveBeenCalled();
    });
  });
});
