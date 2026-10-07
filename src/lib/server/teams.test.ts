import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Team } from "$lib/db/schema";

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockInnerJoin,
  mockOrderBy,
  mockLimit,
  mockOffset,
  mockUpdate,
  mockUpdateSet,
  mockUpdateWhere,
  mockUpdateReturning,
  mockTransaction,
  mockTxSelect,
  mockTxFrom,
  mockTxWhere,
  mockTxInsert,
  mockTxInsertValues,
  mockTxInsertReturning,
  mockTxDelete,
  mockTxDeleteWhere,
  mockTxDeleteReturning,
  mockLogEvent,
  mockLogEventInTx,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockOrderBy: vi.fn(),
  mockLimit: vi.fn(),
  mockOffset: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockTransaction: vi.fn(),
  mockTxSelect: vi.fn(),
  mockTxFrom: vi.fn(),
  mockTxWhere: vi.fn(),
  mockTxInsert: vi.fn(),
  mockTxInsertValues: vi.fn(),
  mockTxInsertReturning: vi.fn(),
  mockTxDelete: vi.fn(),
  mockTxDeleteWhere: vi.fn(),
  mockTxDeleteReturning: vi.fn(),
  mockLogEvent: vi.fn(),
  mockLogEventInTx: vi.fn(),
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

vi.mock("$lib/server/crypto", () => ({
  escapeLikePattern: (s: string) => s.replace(/[%_\\]/g, "\\$&"),
}));

vi.mock("$lib/server/events", () => ({
  logEvent: mockLogEvent,
  logEventInTx: mockLogEventInTx,
}));

import {
  counters,
  dashboards,
  teamMembers,
  teams as teamsTable,
} from "$lib/db/schema";
import {
  createTeam,
  deleteTeam,
  getSoleOwnedTeams,
  getTeam,
  getTeamResources,
  listAllTeams,
  listEditableTeams,
  listUserTeams,
  updateTeam,
} from "./teams";

const tx = {
  select: mockTxSelect,
  insert: mockTxInsert,
  delete: mockTxDelete,
};

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: crypto.randomUUID(),
    name: "Test Team",
    description: null,
    joinToken: null,
    joinRole: "viewer",
    createdBy: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setupChains() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere, innerJoin: mockInnerJoin });
  mockInnerJoin.mockReturnValue({ where: mockWhere });
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });

  mockTxSelect.mockReturnValue({ from: mockTxFrom });
  mockTxFrom.mockReturnValue({ where: mockTxWhere });
  mockTxInsert.mockReturnValue({ values: mockTxInsertValues });
  mockTxInsertValues.mockReturnValue({ returning: mockTxInsertReturning });
  mockTxDelete.mockReturnValue({ where: mockTxDeleteWhere });
  mockTxDeleteWhere.mockReturnValue({ returning: mockTxDeleteReturning });

  mockTransaction.mockImplementation(async (fn: (tx: any) => unknown) =>
    fn(tx),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupChains();
});

describe("createTeam", () => {
  it("inserts the team and an owner membership in one transaction", async () => {
    const team = makeTeam({ name: "Alpha" });
    mockTxInsertReturning.mockResolvedValueOnce([team]);

    const result = await createTeam({
      name: "  Alpha  ",
      description: "  ",
      userId: "user-1",
    });

    expect(result).toEqual(team);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTxInsert).toHaveBeenNthCalledWith(1, teamsTable);
    expect(mockTxInsertValues).toHaveBeenNthCalledWith(1, {
      name: "Alpha",
      description: null,
      createdBy: "user-1",
    });
    expect(mockTxInsert).toHaveBeenNthCalledWith(2, teamMembers);
    expect(mockTxInsertValues).toHaveBeenNthCalledWith(2, {
      teamId: team.id,
      userId: "user-1",
      role: "owner",
    });
  });

  it("logs a team_created event", async () => {
    const team = makeTeam({ name: "Alpha" });
    mockTxInsertReturning.mockResolvedValueOnce([team]);

    await createTeam({ name: "Alpha", userId: "user-1" });

    expect(mockLogEvent).toHaveBeenCalledWith({
      eventType: "team_created",
      userId: "user-1",
      entityId: team.id,
      entityType: "team",
      metadata: { team_name: "Alpha" },
    });
  });
});

describe("getTeam", () => {
  it("returns the team when found", async () => {
    const team = makeTeam();
    mockWhere.mockResolvedValueOnce([team]);

    expect(await getTeam(team.id)).toEqual(team);
  });

  it("returns null when not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    expect(await getTeam("missing")).toBeNull();
  });
});

describe("updateTeam", () => {
  it("trims fields and bumps updatedAt", async () => {
    const team = makeTeam({ name: "Renamed" });
    mockUpdateReturning.mockResolvedValueOnce([team]);

    const result = await updateTeam(team.id, {
      name: " Renamed ",
      description: "",
    });

    expect(result).toEqual(team);
    const set = mockUpdateSet.mock.calls[0][0];
    expect(set.name).toBe("Renamed");
    expect(set.description).toBeNull();
    expect(set.updatedAt).toBeInstanceOf(Date);
  });

  it("only sets provided fields", async () => {
    mockUpdateReturning.mockResolvedValueOnce([makeTeam()]);

    await updateTeam("team-1", { description: "New description" });

    const set = mockUpdateSet.mock.calls[0][0];
    expect(set).not.toHaveProperty("name");
    expect(set.description).toBe("New description");
  });

  it("returns null when team does not exist", async () => {
    mockUpdateReturning.mockResolvedValueOnce([]);

    expect(await updateTeam("missing", { name: "x" })).toBeNull();
  });
});

describe("deleteTeam", () => {
  const mockTeamFor = vi.fn();

  /** Team row query that is locked with `.for(...)`. */
  function teamRow(data: unknown[]) {
    mockTeamFor.mockResolvedValueOnce(data);
    return { for: mockTeamFor };
  }

  it("returns deleted false and deletes nothing when team does not exist", async () => {
    mockTxWhere.mockReturnValueOnce(teamRow([]));

    const result = await deleteTeam("missing", "user-1");

    expect(result).toEqual({
      deleted: false,
      counterIds: [],
      dashboardIds: [],
      memberIds: [],
    });
    expect(mockTxDelete).not.toHaveBeenCalled();
    expect(mockLogEventInTx).not.toHaveBeenCalled();
  });

  it("deletes dashboards, counters, then the team and returns the ids", async () => {
    mockTxWhere
      .mockReturnValueOnce(teamRow([{ name: "Alpha" }]))
      .mockResolvedValueOnce([{ userId: "user-1" }, { userId: "user-2" }]);
    mockTxDeleteReturning
      .mockResolvedValueOnce([{ id: "d-1", title: "Board", ownerId: "user-2" }])
      .mockResolvedValueOnce([
        { id: "c-1", title: "Counter 1", ownerId: "user-2" },
        { id: "c-2", title: "Counter 2", ownerId: null },
      ]);

    const result = await deleteTeam("team-1", "user-1");

    expect(result).toEqual({
      deleted: true,
      counterIds: ["c-1", "c-2"],
      dashboardIds: ["d-1"],
      memberIds: ["user-1", "user-2"],
    });
    expect(mockTxDelete).toHaveBeenNthCalledWith(1, dashboards);
    expect(mockTxDelete).toHaveBeenNthCalledWith(2, counters);
    expect(mockTxDelete).toHaveBeenNthCalledWith(3, teamsTable);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTeamFor).toHaveBeenCalledWith("update");
  });

  it("logs deletion events inside the transaction", async () => {
    mockTxWhere
      .mockReturnValueOnce(teamRow([{ name: "Alpha" }]))
      .mockResolvedValueOnce([]);
    mockTxDeleteReturning
      .mockResolvedValueOnce([{ id: "d-1", title: "Board", ownerId: "user-2" }])
      .mockResolvedValueOnce([
        { id: "c-1", title: "Counter 1", ownerId: "user-2" },
      ]);

    await deleteTeam("team-1", "admin-1");

    expect(mockLogEventInTx).toHaveBeenCalledTimes(3);
    expect(mockLogEventInTx).toHaveBeenCalledWith(tx, {
      eventType: "dashboard_deleted",
      userId: "admin-1",
      entityId: "d-1",
      entityType: "dashboard",
      metadata: { dashboard_title: "Board", owner_id: "user-2" },
    });
    expect(mockLogEventInTx).toHaveBeenCalledWith(tx, {
      eventType: "counter_deleted",
      userId: "admin-1",
      entityId: "c-1",
      entityType: "counter",
      metadata: { counter_title: "Counter 1", owner_id: "user-2" },
    });
    expect(mockLogEventInTx).toHaveBeenLastCalledWith(tx, {
      eventType: "team_deleted",
      userId: "admin-1",
      entityId: "team-1",
      entityType: "team",
      metadata: { team_name: "Alpha", counter_count: 1, dashboard_count: 1 },
    });
  });
});

describe("listUserTeams", () => {
  it("returns teams with role and numeric counts", async () => {
    const { joinToken: _, ...team } = makeTeam({ name: "Alpha" });
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce([
      {
        team: { ...team, joinToken: null },
        role: "editor",
        memberCount: "3",
        counterCount: 2,
        dashboardCount: "1",
      },
    ]);

    const result = await listUserTeams("user-1");

    expect(result).toEqual([
      {
        ...team,
        role: "editor",
        memberCount: 3,
        counterCount: 2,
        dashboardCount: 1,
      },
    ]);
    expect(mockInnerJoin).toHaveBeenCalled();
  });

  it("returns an empty array when the user has no teams", async () => {
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce([]);

    expect(await listUserTeams("user-1")).toEqual([]);
  });

  it("never exposes the join token, even to owners", async () => {
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce([
      {
        team: makeTeam({ joinToken: "secret" }),
        role: "owner",
        memberCount: 1,
        counterCount: 0,
        dashboardCount: 0,
      },
    ]);

    const [team] = await listUserTeams("user-1");

    expect(team).not.toHaveProperty("joinToken");
  });
});

describe("listEditableTeams", () => {
  it("returns id and name of teams joined via team_members", async () => {
    const rows = [{ id: "t-1", name: "Alpha" }];
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce(rows);

    expect(await listEditableTeams("user-1")).toEqual(rows);
    expect(mockFrom).toHaveBeenCalledWith(teamMembers);
    expect(mockInnerJoin).toHaveBeenCalled();
  });
});

describe("getTeamResources", () => {
  it("returns the team's counters and dashboards", async () => {
    const counterRows = [{ id: "c-1" }];
    const dashboardRows = [{ id: "d-1" }];
    mockWhere
      .mockReturnValueOnce({ orderBy: mockOrderBy })
      .mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy
      .mockResolvedValueOnce(counterRows)
      .mockResolvedValueOnce(dashboardRows);

    const result = await getTeamResources("team-1");

    expect(result).toEqual({
      counters: counterRows,
      dashboards: dashboardRows,
    });
    expect(mockFrom).toHaveBeenNthCalledWith(1, counters);
    expect(mockFrom).toHaveBeenNthCalledWith(2, dashboards);
  });
});

describe("listAllTeams", () => {
  function setupListQueries(rows: unknown[], total: number) {
    // Main query: select().from().where().orderBy().limit().offset()
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOffset.mockResolvedValueOnce(rows);
    // Count query: select().from().where()
    mockWhere.mockResolvedValueOnce([{ total }]);
  }

  it("returns teams with counts and total", async () => {
    const { joinToken: _, ...team } = makeTeam({ joinToken: "secret" });
    setupListQueries(
      [
        {
          team: { ...team, joinToken: "secret" },
          memberCount: "2",
          counterCount: "5",
          dashboardCount: "0",
        },
      ],
      7,
    );

    const result = await listAllTeams();

    expect(result.total).toBe(7);
    expect(result.items).toEqual([
      { ...team, memberCount: 2, counterCount: 5, dashboardCount: 0 },
    ]);
    expect(mockLimit).toHaveBeenCalledWith(50);
    expect(mockOffset).toHaveBeenCalledWith(0);
  });

  it("applies a search filter when a query is given", async () => {
    setupListQueries([], 0);

    await listAllTeams(10, "alpha", 20);

    expect(mockWhere.mock.calls[0][0]).toBeDefined();
    expect(mockLimit).toHaveBeenCalledWith(10);
    expect(mockOffset).toHaveBeenCalledWith(20);
  });

  it("does not filter when the query is blank", async () => {
    setupListQueries([], 0);

    await listAllTeams(10, "   ");

    expect(mockWhere.mock.calls[0][0]).toBeUndefined();
  });
});

describe("getSoleOwnedTeams", () => {
  it("returns teams with numeric counts", async () => {
    const { joinToken: _, ...team } = makeTeam({ joinToken: "secret" });
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce([
      {
        team: { ...team, joinToken: "secret" },
        memberCount: "4",
        counterCount: "3",
        dashboardCount: "2",
      },
    ]);

    const result = await getSoleOwnedTeams("user-1");

    expect(result).toEqual([
      { ...team, memberCount: 4, counterCount: 3, dashboardCount: 2 },
    ]);
    expect(mockInnerJoin).toHaveBeenCalled();
  });

  it("returns an empty array when the user solely owns no teams", async () => {
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce([]);

    expect(await getSoleOwnedTeams("user-1")).toEqual([]);
  });
});
