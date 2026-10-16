import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLeftJoin = vi.fn();
const mockOrderBy = vi.fn();
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDeleteReturning = vi.fn();
const mockTransaction = vi.fn();
const mockTxSelect = vi.fn();
const mockTxFrom = vi.fn();
const mockTxWhere = vi.fn();
const mockTxDelete = vi.fn();
const mockTxDeleteWhere = vi.fn();
const mockTxDeleteReturning = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const tx = {
  select: (...args: unknown[]) => mockTxSelect(...args),
  delete: (...args: unknown[]) => mockTxDelete(...args),
};

/** Query result that can be awaited directly or after `.for(...)`. */
function rows<T>(data: T[]) {
  return Object.assign(Promise.resolve(data), {
    for: () => Promise.resolve(data),
  });
}

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("$lib/server/events", () => ({
  logEvent: vi.fn(),
}));

const mockGetSoleOwnedTeams = vi.fn();
const mockDeleteTeamInTx = vi.fn();

vi.mock("$lib/server/teams", () => ({
  getSoleOwnedTeams: (...args: unknown[]) => mockGetSoleOwnedTeams(...args),
  deleteTeamInTx: (...args: unknown[]) => mockDeleteTeamInTx(...args),
}));

const mockEmitTeamMembershipChanged = vi.fn();

vi.mock("$lib/utils/socket", () => ({
  emitTeamMembershipChanged: (...args: unknown[]) =>
    mockEmitTeamMembershipChanged(...args),
}));

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockDelete.mockReturnValue({ where: mockDeleteWhere });
mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });

import { counters, dashboards, teams, users } from "$lib/db/schema";
import { logEvent } from "$lib/server/events";
import { SoleTeamOwnerError } from "$lib/server/team-limits";
import {
  deleteUser,
  getAdminStats,
  getConnectedProviders,
  getUserDetail,
  listUsers,
} from "./users";

describe("getAdminStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it("returns user, counter, dashboard and team counts", async () => {
    mockFrom
      .mockResolvedValueOnce([{ count: 10 }])
      .mockResolvedValueOnce([{ count: 20 }])
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([{ count: 2 }]);

    const stats = await getAdminStats();

    expect(stats).toEqual({
      userCount: 10,
      counterCount: 20,
      dashboardCount: 3,
      teamCount: 2,
    });
    expect(mockFrom).toHaveBeenNthCalledWith(4, teams);
  });

  it("defaults counts to 0 when no rows are returned", async () => {
    mockFrom.mockResolvedValue([]);

    const stats = await getAdminStats();

    expect(stats).toEqual({
      userCount: 0,
      counterCount: 0,
      dashboardCount: 0,
      teamCount: 0,
    });
  });
});

describe("deleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(tx),
    );
    mockTxSelect.mockReturnValue({ from: mockTxFrom });
    mockTxFrom.mockReturnValue({ where: mockTxWhere });
    mockTxDelete.mockReturnValue({ where: mockTxDeleteWhere });
    mockGetSoleOwnedTeams.mockReset();
    mockGetSoleOwnedTeams.mockResolvedValue([]);
    mockDeleteTeamInTx.mockReset();
    mockDeleteTeamInTx.mockResolvedValue({
      deleted: true,
      counterIds: [],
      dashboardIds: [],
      memberIds: [],
    });
  });

  function soleTeam(id: string, memberCount = 1) {
    return {
      id,
      name: `Team ${id}`,
      memberCount,
      counterCount: 0,
      dashboardCount: 0,
    };
  }

  /** Queues the transaction's selects: user row, owner-row lock, one team lock per sole-owned team. */
  function setupPersonalDeletes(userRows: unknown[], lockedTeamIds: string[] = []) {
    mockTxWhere.mockReturnValueOnce(rows(userRows));
    mockTxWhere.mockReturnValueOnce(rows([]));
    for (const id of lockedTeamIds) {
      mockTxWhere.mockReturnValueOnce(rows([{ id }]));
    }
    // dashboards, counters: awaited directly
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);
    // users: .returning()
    mockTxDeleteWhere.mockReturnValueOnce({ returning: mockTxDeleteReturning });
  }

  it("deletes personal dashboards and counters, then the user, returns true", async () => {
    setupPersonalDeletes([{ username: "testuser", email: "test@test.com" }]);
    mockTxDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    const result = await deleteUser("user-1");

    expect(result).toBe(true);
    expect(mockTxDelete).toHaveBeenCalledTimes(3);
    expect(mockTxDelete).toHaveBeenNthCalledWith(1, dashboards);
    expect(mockTxDelete).toHaveBeenNthCalledWith(2, counters);
    expect(mockTxDelete).toHaveBeenNthCalledWith(3, users);
    expect(mockDeleteTeamInTx).not.toHaveBeenCalled();
  });

  it("runs every statement in one transaction", async () => {
    setupPersonalDeletes([{ username: "testuser", email: "t@t.com" }]);
    mockTxDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1");

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockGetSoleOwnedTeams).toHaveBeenCalledWith("user-1", tx);
  });

  it("scopes personal deletes to resources without a team", async () => {
    setupPersonalDeletes([]);
    mockTxDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1");

    const dialect = new PgDialect();
    const [dashboardWhere, counterWhere] = mockTxDeleteWhere.mock.calls.map(
      (call) => dialect.sqlToQuery(call[0] as SQL).sql,
    );
    expect(dashboardWhere).toContain('"dashboards"."owner_id" = $1');
    expect(dashboardWhere).toContain('"dashboards"."team_id" is null');
    expect(counterWhere).toContain('"counters"."owner_id" = $1');
    expect(counterWhere).toContain('"counters"."team_id" is null');
  });

  it("deletes teams where the user is the only member before personal resources", async () => {
    mockGetSoleOwnedTeams.mockResolvedValue([soleTeam("team-1"), soleTeam("team-2")]);
    setupPersonalDeletes([], ["team-1", "team-2"]);
    mockTxDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1", "admin-1");

    expect(mockDeleteTeamInTx).toHaveBeenCalledTimes(2);
    expect(mockDeleteTeamInTx).toHaveBeenNthCalledWith(1, tx, "team-1", "admin-1");
    expect(mockDeleteTeamInTx).toHaveBeenNthCalledWith(2, tx, "team-2", "admin-1");
    expect(mockDeleteTeamInTx.mock.invocationCallOrder[1]).toBeLessThan(
      mockTxDelete.mock.invocationCallOrder[0],
    );
  });

  it("re-reads the sole-owned teams after locking them", async () => {
    mockGetSoleOwnedTeams
      .mockResolvedValueOnce([soleTeam("team-1")])
      .mockResolvedValueOnce([soleTeam("team-1", 2)]);
    setupPersonalDeletes([], ["team-1"]);

    await expect(deleteUser("user-1")).rejects.toBeInstanceOf(
      SoleTeamOwnerError,
    );

    expect(mockGetSoleOwnedTeams).toHaveBeenCalledTimes(2);
    expect(mockDeleteTeamInTx).not.toHaveBeenCalled();
  });

  it("throws SoleTeamOwnerError listing teams that still have other members", async () => {
    mockGetSoleOwnedTeams.mockResolvedValue([
      soleTeam("team-1", 3),
      soleTeam("team-2", 2),
    ]);
    setupPersonalDeletes([], ["team-1", "team-2"]);

    const error = await deleteUser("user-1").catch((e) => e);

    expect(error).toBeInstanceOf(SoleTeamOwnerError);
    expect(error.teams).toEqual([
      { id: "team-1", name: "Team team-1", memberCount: 3 },
      { id: "team-2", name: "Team team-2", memberCount: 2 },
    ]);
  });

  it("changes nothing when any sole-owned team has other members", async () => {
    // team-1 alone would be cascaded, but team-2 blocks the whole deletion
    mockGetSoleOwnedTeams.mockResolvedValue([
      soleTeam("team-1", 1),
      soleTeam("team-2", 4),
    ]);
    setupPersonalDeletes([{ username: "u", email: "e" }], ["team-1", "team-2"]);

    await expect(deleteUser("user-1")).rejects.toBeInstanceOf(
      SoleTeamOwnerError,
    );

    expect(mockDeleteTeamInTx).not.toHaveBeenCalled();
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
    expect(mockEmitTeamMembershipChanged).not.toHaveBeenCalled();
  });

  it("rolls back by rejecting, without events or notifications, when a later step fails", async () => {
    mockGetSoleOwnedTeams.mockResolvedValue([soleTeam("team-1")]);
    mockDeleteTeamInTx.mockResolvedValueOnce({
      deleted: true,
      counterIds: [],
      dashboardIds: [],
      memberIds: ["user-1", "user-2"],
    });
    setupPersonalDeletes([{ username: "u", email: "e" }], ["team-1"]);
    mockTxDeleteReturning.mockRejectedValueOnce(new Error("db down"));

    await expect(deleteUser("user-1")).rejects.toThrow("db down");

    expect(logEvent).not.toHaveBeenCalled();
    expect(mockEmitTeamMembershipChanged).not.toHaveBeenCalled();
  });

  it("uses the deleted user as team-deletion actor when no actor is given", async () => {
    mockGetSoleOwnedTeams.mockResolvedValue([soleTeam("team-1")]);
    setupPersonalDeletes([], ["team-1"]);
    mockTxDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1");

    expect(mockDeleteTeamInTx).toHaveBeenCalledWith(tx, "team-1", "user-1");
  });

  it("notifies remaining members of deleted sole-owned teams", async () => {
    mockGetSoleOwnedTeams.mockResolvedValue([soleTeam("team-1"), soleTeam("team-2")]);
    mockDeleteTeamInTx
      .mockResolvedValueOnce({
        deleted: true,
        counterIds: [],
        dashboardIds: [],
        memberIds: ["user-1", "user-2", "user-3"],
      })
      .mockResolvedValueOnce({
        deleted: false,
        counterIds: [],
        dashboardIds: [],
        memberIds: [],
      });
    setupPersonalDeletes([], ["team-1", "team-2"]);
    mockTxDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1");

    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledTimes(1);
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(
      ["user-2", "user-3"],
      { teamId: "team-1", reason: "team_deleted" },
    );
  });

  it("does not read or log the full name of the deleted user", async () => {
    setupPersonalDeletes([{ username: null, email: "test@test.com" }]);
    mockTxDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1");

    const selection = mockTxSelect.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.values(selection)).not.toContain(users.name);
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "user_deleted",
        metadata: { user_name: null, email: "test@test.com" },
      }),
    );
  });

  it("returns false when user not found", async () => {
    setupPersonalDeletes([]);
    mockTxDeleteReturning.mockResolvedValueOnce([]);

    const result = await deleteUser("nonexistent");

    expect(result).toBe(false);
    expect(mockTxDelete).toHaveBeenCalledTimes(3);
    expect(logEvent).not.toHaveBeenCalled();
  });
});

describe("getConnectedProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
  });

  it("returns list of provider names", async () => {
    mockWhere.mockResolvedValueOnce([
      { provider: "github" },
      { provider: "google" },
    ]);

    const result = await getConnectedProviders("user-1");

    expect(result).toEqual(["github", "google"]);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledOnce();
  });

  it("returns empty array when no providers connected", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const result = await getConnectedProviders("user-1");

    expect(result).toEqual([]);
  });
});

describe("getUserDetail", () => {
  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    image: null,
    username: "testuser",
    roleName: "admin",
    roleId: 1,
    createdAt: new Date("2024-01-01"),
  };

  function setupUserQuery(userResult: unknown[]) {
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ leftJoin: mockLeftJoin });
    mockLeftJoin.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockResolvedValueOnce(userResult);
  }

  function setupParallelQueries(
    actionCount: number,
    counterRows: unknown[],
    dashboardRows: unknown[],
  ) {
    // totalActions: select → from → where
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockResolvedValueOnce([{ count: actionCount }]);

    // counterRows: select → from → where → orderBy
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce(counterRows);

    // dashboardRows: select → from → where → orderBy
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce(dashboardRows);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user not found", async () => {
    setupUserQuery([]);

    const result = await getUserDetail("nonexistent");

    expect(result).toBeNull();
    expect(mockSelect).toHaveBeenCalledOnce();
    const selection = mockSelect.mock.calls[0][0] as Record<string, unknown>;
    expect(selection).not.toHaveProperty("name");
    expect(Object.values(selection)).not.toContain(users.name);
  });

  it("returns complete detail when user exists", async () => {
    setupUserQuery([mockUser]);
    setupParallelQueries(
      5,
      [
        {
          id: "c-1",
          title: "Counter 1",
          count: 10,
          visibilityMode: "public",
          isPublic: 1,
          counterMode: "increment",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
          actionCount: "3",
        },
      ],
      [
        {
          id: "d-1",
          title: "Dashboard 1",
          visibilityMode: "public",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
        },
      ],
    );

    const result = await getUserDetail("user-1");

    expect(result).toEqual({
      user: mockUser,
      actionCount: 5,
      ownedCounters: [
        {
          id: "c-1",
          title: "Counter 1",
          count: 10,
          visibilityMode: "public",
          isPublic: 1,
          counterMode: "increment",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
          actionCount: 3,
        },
      ],
      ownedDashboards: [
        {
          id: "d-1",
          title: "Dashboard 1",
          visibilityMode: "public",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-06-01"),
        },
      ],
    });
    // 1 user query + 3 parallel queries
    expect(mockSelect).toHaveBeenCalledTimes(4);
  });

  it("returns zero actionCount when no history exists", async () => {
    setupUserQuery([mockUser]);
    setupParallelQueries(0, [], []);

    const result = await getUserDetail("user-1");

    expect(result).not.toBeNull();
    expect(result?.actionCount).toBe(0);
  });

  it("returns empty arrays for counters and dashboards when user has none", async () => {
    setupUserQuery([mockUser]);
    setupParallelQueries(2, [], []);

    const result = await getUserDetail("user-1");

    expect(result).not.toBeNull();
    expect(result?.ownedCounters).toEqual([]);
    expect(result?.ownedDashboards).toEqual([]);
    expect(result?.actionCount).toBe(2);
  });
});

describe("listUsers", () => {
  const mockLimit = vi.fn();
  const mockOffset = vi.fn();
  const mockCountWhere = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ leftJoin: mockLeftJoin });
    mockLeftJoin.mockReturnValueOnce({ where: mockWhere });
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValueOnce({ limit: mockLimit });
    mockLimit.mockReturnValueOnce({ offset: mockOffset });
    mockOffset.mockResolvedValueOnce([]);

    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValueOnce({ where: mockCountWhere });
    mockCountWhere.mockResolvedValueOnce([{ total: 0 }]);
  });

  it("does not select or search by the full name", async () => {
    await listUsers(20, "jane");

    const selection = mockSelect.mock.calls[0][0] as Record<string, unknown>;
    expect(selection).not.toHaveProperty("name");
    expect(Object.values(selection)).not.toContain(users.name);

    const whereSql = new PgDialect().sqlToQuery(
      mockWhere.mock.calls[0][0] as SQL,
    ).sql;
    expect(whereSql).toContain('"user"."username"');
    expect(whereSql).toContain('"user"."email"');
    expect(whereSql).not.toContain('"user"."name"');
  });
});
