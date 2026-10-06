import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dashboard } from "$lib/db/schema";

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

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
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

  it("falls back to display name when username is null", async () => {
    const dashboard = makeDashboard({ title: "Fallback" });
    mockOffset.mockResolvedValue([
      { dashboard, ownerUsername: null, ownerDisplayName: "Jane Doe" },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 1 }]);

    const result = await listAllDashboards();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].ownerName).toBe("Jane Doe");
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
