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

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("$lib/server/events", () => ({
  logEvent: vi.fn(),
}));

const mockGetSoleOwnedTeams = vi.fn();
const mockDeleteTeam = vi.fn();

vi.mock("$lib/server/teams", () => ({
  getSoleOwnedTeams: (...args: unknown[]) => mockGetSoleOwnedTeams(...args),
  deleteTeam: (...args: unknown[]) => mockDeleteTeam(...args),
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
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockGetSoleOwnedTeams.mockResolvedValue([]);
    mockDeleteTeam.mockResolvedValue({
      deleted: true,
      counterIds: [],
      dashboardIds: [],
      memberIds: [],
    });
  });

  function setupPersonalDeletes(userRows: unknown[]) {
    mockWhere.mockResolvedValueOnce(userRows);
    // dashboards, counters: awaited directly
    mockDeleteWhere.mockResolvedValueOnce(undefined);
    mockDeleteWhere.mockResolvedValueOnce(undefined);
    // users: .returning()
    mockDeleteWhere.mockReturnValueOnce({ returning: mockDeleteReturning });
  }

  it("deletes personal dashboards and counters, then the user, returns true", async () => {
    setupPersonalDeletes([{ username: "testuser", email: "test@test.com" }]);
    mockDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    const result = await deleteUser("user-1");

    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(3);
    expect(mockDelete).toHaveBeenNthCalledWith(1, dashboards);
    expect(mockDelete).toHaveBeenNthCalledWith(2, counters);
    expect(mockDelete).toHaveBeenNthCalledWith(3, users);
    expect(mockDeleteTeam).not.toHaveBeenCalled();
  });

  it("scopes personal deletes to resources without a team", async () => {
    setupPersonalDeletes([]);
    mockDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1");

    const dialect = new PgDialect();
    const [dashboardWhere, counterWhere] = mockDeleteWhere.mock.calls.map(
      (call) => dialect.sqlToQuery(call[0] as SQL).sql,
    );
    expect(dashboardWhere).toContain('"dashboards"."owner_id" = $1');
    expect(dashboardWhere).toContain('"dashboards"."team_id" is null');
    expect(counterWhere).toContain('"counters"."owner_id" = $1');
    expect(counterWhere).toContain('"counters"."team_id" is null');
  });

  it("deletes sole-owned teams before personal resources", async () => {
    mockGetSoleOwnedTeams.mockResolvedValueOnce([
      { id: "team-1" },
      { id: "team-2" },
    ]);
    setupPersonalDeletes([]);
    mockDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1", "admin-1");

    expect(mockGetSoleOwnedTeams).toHaveBeenCalledWith("user-1");
    expect(mockDeleteTeam).toHaveBeenCalledTimes(2);
    expect(mockDeleteTeam).toHaveBeenNthCalledWith(1, "team-1", "admin-1");
    expect(mockDeleteTeam).toHaveBeenNthCalledWith(2, "team-2", "admin-1");
    expect(mockDeleteTeam.mock.invocationCallOrder[1]).toBeLessThan(
      mockDelete.mock.invocationCallOrder[0],
    );
  });

  it("uses the deleted user as team-deletion actor when no actor is given", async () => {
    mockGetSoleOwnedTeams.mockResolvedValueOnce([{ id: "team-1" }]);
    setupPersonalDeletes([]);
    mockDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1");

    expect(mockDeleteTeam).toHaveBeenCalledWith("team-1", "user-1");
  });

  it("notifies remaining members of deleted sole-owned teams", async () => {
    mockGetSoleOwnedTeams.mockResolvedValueOnce([
      { id: "team-1" },
      { id: "team-2" },
    ]);
    mockDeleteTeam
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
    setupPersonalDeletes([]);
    mockDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1");

    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledTimes(1);
    expect(mockEmitTeamMembershipChanged).toHaveBeenCalledWith(
      ["user-2", "user-3"],
      { teamId: "team-1", reason: "team_deleted" },
    );
  });

  it("does not read or log the full name of the deleted user", async () => {
    setupPersonalDeletes([{ username: null, email: "test@test.com" }]);
    mockDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    await deleteUser("user-1");

    const selection = mockSelect.mock.calls[0][0] as Record<string, unknown>;
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
    mockDeleteReturning.mockResolvedValueOnce([]);

    const result = await deleteUser("nonexistent");

    expect(result).toBe(false);
    expect(mockDelete).toHaveBeenCalledTimes(3);
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

    const whereSql = new PgDialect().sqlToQuery(mockWhere.mock.calls[0][0] as SQL)
      .sql;
    expect(whereSql).toContain('"user"."username"');
    expect(whereSql).toContain('"user"."email"');
    expect(whereSql).not.toContain('"user"."name"');
  });
});
