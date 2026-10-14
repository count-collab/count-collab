import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dashboard } from "$lib/db/schema";
import { dashboardFollowers, dashboards } from "$lib/db/schema";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockLeftJoin = vi.fn();
const mockOffset = vi.fn();
const mockCountFrom = vi.fn();
const mockCountWhere = vi.fn();
const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDeleteReturning = vi.fn();
const mockTransaction = vi.fn();
const { mockRefitDashboardItems } = vi.hoisted(() => ({
  mockRefitDashboardItems: vi.fn(),
}));

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("$lib/server/dashboard-items", () => ({
  refitDashboardItems: mockRefitDashboardItems,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("$lib/server/crypto", () => ({
  escapeLikePattern: (s: string) => s.replace(/[%_\\]/g, "\\$&"),
  generateShareToken: () => "mock-share-token",
}));

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({ orderBy: mockOrderBy });
mockOrderBy.mockReturnValue({ limit: mockLimit });
mockInsert.mockReturnValue({ values: mockInsertValues });
mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
mockUpdate.mockReturnValue({ set: mockUpdateSet });
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
mockDelete.mockReturnValue({ where: mockDeleteWhere });
mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });

import {
  getOwnedDashboards,
  getSharedDashboards,
  getUserDashboards,
  listAllDashboards,
  listPublicDashboards,
  regenerateDashboardShareToken,
  updateDashboard,
} from "./dashboards";

const dialect = new PgDialect();

function toSql(clause: unknown): string {
  return dialect.sqlToQuery(clause as SQL).sql;
}

function makeDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    id: crypto.randomUUID(),
    title: "Test Dashboard",
    description: null,
    visibilityMode: "public",
    shareToken: null,
    ownerId: null,
    teamId: null,
    gridColumns: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("listAllDashboards", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Main query chain: select().from().leftJoin().where().orderBy().limit().offset()
    mockSelect.mockReturnValueOnce({ from: mockFrom });
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin });
    mockLeftJoin.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ offset: mockOffset });

    // Count query chain: select().from().where()
    mockSelect.mockReturnValueOnce({ from: mockCountFrom });
    mockCountFrom.mockReturnValue({ where: mockCountWhere });
  });

  it("returns dashboards with ownerName from username", async () => {
    const dashboard = makeDashboard({ title: "My Board" });
    mockOffset.mockResolvedValue([
      { dashboard, ownerUsername: "janedoe", ownerDisplayName: "Jane Doe" },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 1 }]);

    const result = await listAllDashboards();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].ownerName).toBe("janedoe");
    expect(result.items[0].title).toBe("My Board");
  });

  it("never falls back to the full name when username is null", async () => {
    const dashboard = makeDashboard({ title: "Fallback" });
    mockOffset.mockResolvedValue([
      { dashboard, ownerUsername: null, ownerDisplayName: "Jane Doe" },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 1 }]);

    const result = await listAllDashboards();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].ownerName).toBeNull();
    expect(JSON.stringify(result)).not.toContain("Jane Doe");
  });

  it("returns ownerName as null when no owner exists", async () => {
    const dashboard = makeDashboard({ title: "No Owner" });
    mockOffset.mockResolvedValue([
      { dashboard, ownerUsername: null, ownerDisplayName: null },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 1 }]);

    const result = await listAllDashboards();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].ownerName).toBeNull();
  });

  it("returns the total count", async () => {
    const dashboard = makeDashboard();
    mockOffset.mockResolvedValue([
      { dashboard, ownerUsername: "user1", ownerDisplayName: null },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 5 }]);

    const result = await listAllDashboards();

    expect(result.total).toBe(5);
  });

  it("returns empty array when no dashboards exist", async () => {
    mockOffset.mockResolvedValue([]);
    mockCountWhere.mockResolvedValue([{ total: 0 }]);

    const result = await listAllDashboards();

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("getUserDashboards", () => {
  const itemsLimit = vi.fn();

  function setup(rows: unknown[], total: number) {
    mockSelect
      .mockReturnValueOnce({ from: mockFrom })
      .mockReturnValueOnce({ from: mockCountFrom });
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin });
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({
      $dynamic: () =>
        Object.assign(Promise.resolve(rows), { limit: itemsLimit }),
    });
    itemsLimit.mockReturnValue({ offset: mockOffset });
    mockOffset.mockResolvedValue(rows);
    mockCountFrom.mockReturnValue({
      leftJoin: () => ({ leftJoin: () => ({ where: mockCountWhere }) }),
    });
    mockCountWhere.mockResolvedValue([{ total }]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes team dashboards with team info", async () => {
    const personal = {
      ...makeDashboard({ ownerId: "user-1" }),
      teamName: null,
    };
    const teamDashboard = {
      ...makeDashboard({ ownerId: "user-2", teamId: "team-1" }),
      teamName: "Alpha",
    };
    setup([personal, teamDashboard], 2);

    const result = await getUserDashboards("user-1", 12);

    expect(result).toEqual({ items: [personal, teamDashboard], total: 2 });
    expect(itemsLimit).toHaveBeenCalledWith(12);

    const where = toSql(mockWhere.mock.calls[0][0]);
    expect(where).toContain('"team_members"."user_id" is not null');
    expect(where).toContain('"dashboard_members"."user_id" is not null');
    expect(where).toContain('"dashboards"."team_id" is null');
  });
});

describe("getOwnedDashboards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect
      .mockReturnValueOnce({ from: mockFrom })
      .mockReturnValueOnce({ from: mockCountFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockCountFrom.mockReturnValue({ where: mockCountWhere });
  });

  it("excludes team dashboards created by the user", async () => {
    mockOffset.mockResolvedValue([]);
    mockCountWhere.mockResolvedValue([{ total: 0 }]);

    await getOwnedDashboards("user-1");

    const where = toSql(mockWhere.mock.calls[0][0]);
    expect(where).toContain('"dashboards"."owner_id" = $1');
    expect(where).toContain('"dashboards"."team_id" is null');
  });
});

describe("getSharedDashboards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect
      .mockReturnValueOnce({ from: mockFrom })
      .mockReturnValueOnce({ from: mockCountFrom });
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin });
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockCountFrom.mockReturnValue({
      leftJoin: () => ({ leftJoin: () => ({ where: mockCountWhere }) }),
    });
  });

  it("returns team dashboards with the effective member role", async () => {
    const direct = makeDashboard({ ownerId: "user-2" });
    const team = makeDashboard({ ownerId: "user-1", teamId: "team-1" });
    mockOffset.mockResolvedValue([
      { ...direct, teamName: null, directRole: "editor", teamRole: null },
      {
        ...team,
        teamName: "Alpha",
        directRole: "viewer",
        teamRole: "incrementer",
      },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 2 }]);

    const result = await getSharedDashboards("user-1");

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      { ...direct, teamName: null, memberRole: "editor" },
      { ...team, teamName: "Alpha", memberRole: "viewer" },
    ]);
  });
});

describe("updateDashboard gridColumns", () => {
  const txFor = vi.fn();
  const txUpdateSet = vi.fn();
  const txUpdateReturning = vi.fn();
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ for: txFor }) }) }),
    update: () => ({
      set: (values: unknown) => {
        txUpdateSet(values);
        return { where: () => ({ returning: txUpdateReturning }) };
      },
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );
  });

  it("updates gridColumns and refits items in one transaction when changed", async () => {
    const dashboard = makeDashboard({ gridColumns: 3 });
    txFor.mockResolvedValue([{ gridColumns: 5 }]);
    txUpdateReturning.mockResolvedValue([dashboard]);

    const result = await updateDashboard(dashboard.id, { gridColumns: 3 });

    expect(result).toEqual(dashboard);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(txFor).toHaveBeenCalledWith("update");
    expect(txUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ gridColumns: 3 }),
    );
    expect(mockRefitDashboardItems).toHaveBeenCalledWith(tx, dashboard.id, 3);
  });

  it("skips the refit when gridColumns is unchanged", async () => {
    const dashboard = makeDashboard({ gridColumns: 4 });
    txFor.mockResolvedValue([{ gridColumns: 4 }]);
    txUpdateReturning.mockResolvedValue([dashboard]);

    await updateDashboard(dashboard.id, { title: "New", gridColumns: 4 });

    expect(txUpdateSet).toHaveBeenCalledWith(
      expect.not.objectContaining({ gridColumns: expect.anything() }),
    );
    expect(mockRefitDashboardItems).not.toHaveBeenCalled();
  });

  it("returns null when the dashboard does not exist", async () => {
    txFor.mockResolvedValue([]);

    const result = await updateDashboard(crypto.randomUUID(), {
      gridColumns: 2,
    });

    expect(result).toBeNull();
    expect(txUpdateSet).not.toHaveBeenCalled();
    expect(mockRefitDashboardItems).not.toHaveBeenCalled();
  });

  it("does not open a transaction when gridColumns is omitted", async () => {
    const dashboard = makeDashboard();
    mockUpdateReturning.mockResolvedValue([dashboard]);

    await updateDashboard(dashboard.id, { title: "Renamed" });

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockRefitDashboardItems).not.toHaveBeenCalled();
  });
});

describe("share token exposure", () => {
  const SECRET = "secret-dashboard-token";

  function expectNoShareToken(selection: unknown) {
    expect(selection).toBeTypeOf("object");
    expect(selection).not.toHaveProperty("shareToken");
    expect(Object.values(selection as object)).not.toContain(
      dashboards.shareToken,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listPublicDashboards selects columns without shareToken", async () => {
    const offset = vi.fn().mockResolvedValue([]);
    mockSelect
      .mockReturnValueOnce({
        from: () => ({
          groupBy: () => ({
            as: () => ({
              dashboardId: dashboardFollowers.dashboardId,
              followerCount: dashboardFollowers.id,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              orderBy: () => ({ limit: () => ({ offset }) }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: vi.fn().mockResolvedValue([{ total: 0 }]) }),
      });

    await listPublicDashboards();

    expectNoShareToken(mockSelect.mock.calls[1][0]);
  });

  it("getOwnedDashboards selects columns without shareToken", async () => {
    const offset = vi.fn().mockResolvedValue([]);
    mockSelect
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => ({ offset }) }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: vi.fn().mockResolvedValue([{ total: 0 }]) }),
      });

    await getOwnedDashboards("user-1");

    expectNoShareToken(mockSelect.mock.calls[0][0]);
  });

  it("getUserDashboards selects columns without shareToken", async () => {
    const rows = Object.assign(Promise.resolve([]), {
      limit: () => ({ offset: vi.fn().mockResolvedValue([]) }),
    });
    const joins = { leftJoin: () => joins, where: () => ({ orderBy: () => ({ $dynamic: () => rows }) }) };
    mockSelect
      .mockReturnValueOnce({ from: () => joins })
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: vi.fn().mockResolvedValue([{ total: 0 }]),
            }),
          }),
        }),
      });

    await getUserDashboards("user-1");

    expectNoShareToken(mockSelect.mock.calls[0][0]);
  });

  it("getSharedDashboards selects columns without shareToken", async () => {
    const joins = {
      leftJoin: () => joins,
      where: () => ({
        orderBy: () => ({
          limit: () => ({ offset: vi.fn().mockResolvedValue([]) }),
        }),
      }),
    };
    mockSelect
      .mockReturnValueOnce({ from: () => joins })
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: vi.fn().mockResolvedValue([{ total: 0 }]),
            }),
          }),
        }),
      });

    await getSharedDashboards("user-1", 4);

    expectNoShareToken(mockSelect.mock.calls[0][0]);
  });

  it("listAllDashboards strips shareToken from joined rows", async () => {
    const offset = vi.fn().mockResolvedValue([
      {
        dashboard: makeDashboard({
          visibilityMode: "private",
          shareToken: SECRET,
        }),
        ownerUsername: "u",
        ownerDisplayName: null,
      },
    ]);
    mockSelect
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              orderBy: () => ({ limit: () => ({ offset }) }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: vi.fn().mockResolvedValue([{ total: 1 }]) }),
      });

    const result = await listAllDashboards();

    expect(result.items[0]).not.toHaveProperty("shareToken");
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});

describe("updateDashboard share token lifecycle", () => {
  function existingDashboard(overrides: Partial<Dashboard>) {
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValueOnce([makeDashboard(overrides)]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockUpdateReturning.mockResolvedValue([makeDashboard()]);
  });

  it("clears the token when switching private to public", async () => {
    await updateDashboard("d1", { visibilityMode: "public" });

    expect(mockUpdateSet.mock.calls[0][0]).toMatchObject({
      visibilityMode: "public",
      shareToken: null,
    });
  });

  it("generates a new token when switching public to private", async () => {
    existingDashboard({ visibilityMode: "public", shareToken: null });

    await updateDashboard("d1", { visibilityMode: "private" });

    expect(mockUpdateSet.mock.calls[0][0].shareToken).toBe("mock-share-token");
  });

  it("replaces a stale token left on a public dashboard", async () => {
    existingDashboard({ visibilityMode: "public", shareToken: "stale" });

    await updateDashboard("d1", { visibilityMode: "private" });

    expect(mockUpdateSet.mock.calls[0][0].shareToken).toBe("mock-share-token");
  });

  it("keeps the existing token when staying private", async () => {
    existingDashboard({ visibilityMode: "private", shareToken: "keep-me" });

    await updateDashboard("d1", { visibilityMode: "private" });

    expect(mockUpdateSet.mock.calls[0][0]).not.toHaveProperty("shareToken");
  });

  it("does not touch the token when visibility is unchanged", async () => {
    await updateDashboard("d1", { title: "Renamed" });

    expect(mockUpdateSet.mock.calls[0][0]).not.toHaveProperty("shareToken");
  });
});

describe("regenerateDashboardShareToken", () => {
  const txSet = vi.fn();

  function useTx(
    existing: { visibilityMode: string }[],
    removed: { id: number }[] = [],
  ) {
    const tx = {
      select: () => ({
        from: () => ({ where: () => ({ for: async () => existing }) }),
      }),
      update: () => ({
        set: (values: unknown) => {
          txSet(values);
          return { where: async () => undefined };
        },
      }),
      delete: () => ({ where: () => ({ returning: async () => removed }) }),
    };
    mockTransaction.mockImplementation(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a fresh token and removes followers for private dashboards", async () => {
    useTx([{ visibilityMode: "private" }], [{ id: 1 }, { id: 2 }, { id: 3 }]);

    const result = await regenerateDashboardShareToken("d1");

    expect(result).toEqual({
      ok: true,
      shareToken: "mock-share-token",
      removedFollowers: 3,
    });
    expect(txSet).toHaveBeenCalledWith({ shareToken: "mock-share-token" });
  });

  it("refuses public dashboards without writing", async () => {
    useTx([{ visibilityMode: "public" }]);

    await expect(regenerateDashboardShareToken("d1")).resolves.toEqual({
      ok: false,
      reason: "not_private",
    });
    expect(txSet).not.toHaveBeenCalled();
  });

  it("reports a missing dashboard", async () => {
    useTx([]);

    await expect(regenerateDashboardShareToken("d1")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(txSet).not.toHaveBeenCalled();
  });
});
