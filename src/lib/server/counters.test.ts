import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Counter } from "$lib/db/schema";
import {
  counterHistory,
  counters as countersTable,
  teamMembers,
  teams,
  users,
} from "$lib/db/schema";

const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();
const mockExecute = vi.fn();
const mockTransaction = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Chain: db.select().from().where().orderBy().limit()
mockInsert.mockReturnValue({ values: mockInsertValues });
mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({ orderBy: mockOrderBy });
mockOrderBy.mockReturnValue({ limit: mockLimit });
mockUpdate.mockReturnValue({ set: mockUpdateSet });
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });

import {
  CounterOverflowError,
  INT4_MAX,
  INT4_MIN,
} from "./counter-limits";
import {
  createCounter,
  getCounterCount,
  getCounterSparkline,
  getGlobalActionCount,
  getOwnedCounterCount,
  getOwnedCounters,
  getSharedCounters,
  getUserCounters,
  incrementCounter,
  listAllCounters,
  listPublicCounters,
  listRecentlyCreatedCounters,
  listRecentlyUpdatedCounters,
  regenerateCounterShareToken,
  sparklineCache,
  updateCounter,
} from "./counters";

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: crypto.randomUUID(),
    title: "Test Counter",
    description: null,
    count: 0,
    isPublic: 1,
    visibilityMode: "public",
    counterMode: "increment_only",
    shareToken: null,
    cooldownEnabled: false,
    cooldownSeconds: 5,
    goalsEnabled: false,
    showAllReachedGoals: false,
    scoreboardEnabled: false,
    ownerId: null,
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
    ...overrides,
  };
}

const dialect = new PgDialect();

function toSql(clause: unknown): string {
  return dialect.sqlToQuery(clause as SQL).sql;
}

describe("createCounter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
  });

  it("stores public_readonly as the canonical visibility mode", async () => {
    const counter = makeCounter({ visibilityMode: "public_readonly" });
    mockInsertReturning.mockResolvedValue([counter]);

    const result = await createCounter({
      title: " Read only counter ",
      visibilityMode: "public_readonly",
    });

    expect(result).toEqual(counter);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Read only counter",
        isPublic: 1,
        visibilityMode: "public_readonly",
        shareToken: null,
      }),
    );
  });

  it("passes counterMode to insert", async () => {
    const counter = makeCounter({ counterMode: "both" });
    mockInsertReturning.mockResolvedValue([counter]);

    await createCounter({ title: "Test", counterMode: "both" });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ counterMode: "both" }),
    );
  });

  it("defaults counterMode to increment_only", async () => {
    const counter = makeCounter();
    mockInsertReturning.mockResolvedValue([counter]);

    await createCounter({ title: "Test" });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ counterMode: "increment_only" }),
    );
  });

  it("derives private visibility from the legacy isPublic flag", async () => {
    const counter = makeCounter({
      isPublic: 0,
      visibilityMode: "private",
      shareToken: "private-token",
    });
    mockInsertReturning.mockResolvedValue([counter]);

    await createCounter({ title: "Private counter", isPublic: false });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        isPublic: 0,
        visibilityMode: "private",
      }),
    );
    expect(mockInsertValues.mock.calls[0][0].shareToken).toMatch(
      /^[0-9a-f]{32}$/,
    );
  });
});

describe("listRecentlyCreatedCounters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
  });

  it("returns only public counters ordered by createdAt descending", async () => {
    const now = new Date();
    const counters = [
      makeCounter({ title: "Newest", createdAt: new Date(now.getTime()) }),
      makeCounter({
        title: "Older",
        createdAt: new Date(now.getTime() - 1000),
      }),
    ];
    mockLimit.mockResolvedValue(counters);

    const result = await listRecentlyCreatedCounters();

    expect(result).toEqual(counters);
    expect(result).toHaveLength(2);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledOnce();
    expect(mockOrderBy).toHaveBeenCalledOnce();
    expect(mockLimit).toHaveBeenCalledWith(6);
  });

  it("respects the limit parameter", async () => {
    const counters = [makeCounter(), makeCounter(), makeCounter()];
    mockLimit.mockResolvedValue(counters);

    const result = await listRecentlyCreatedCounters(3);

    expect(result).toHaveLength(3);
    expect(mockLimit).toHaveBeenCalledWith(3);
  });

  it("returns an empty array when no public counters exist", async () => {
    mockLimit.mockResolvedValue([]);

    const result = await listRecentlyCreatedCounters();

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("uses the default limit of 6", async () => {
    mockLimit.mockResolvedValue([]);

    await listRecentlyCreatedCounters();

    expect(mockLimit).toHaveBeenCalledWith(6);
  });
});

describe("listRecentlyUpdatedCounters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
  });

  it("returns only public counters ordered by updatedAt descending", async () => {
    const now = new Date();
    const counters = [
      makeCounter({
        title: "Recently Updated",
        updatedAt: new Date(now.getTime()),
      }),
      makeCounter({
        title: "Updated Earlier",
        updatedAt: new Date(now.getTime() - 5000),
      }),
    ];
    mockLimit.mockResolvedValue(counters);

    const result = await listRecentlyUpdatedCounters();

    expect(result).toEqual(counters);
    expect(result).toHaveLength(2);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledOnce();
    expect(mockOrderBy).toHaveBeenCalledOnce();
    expect(mockLimit).toHaveBeenCalledWith(6);
  });

  it("respects the limit parameter", async () => {
    const counters = [makeCounter()];
    mockLimit.mockResolvedValue(counters);

    const result = await listRecentlyUpdatedCounters(1);

    expect(result).toHaveLength(1);
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it("returns an empty array when no public counters exist", async () => {
    mockLimit.mockResolvedValue([]);

    const result = await listRecentlyUpdatedCounters();

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("uses the default limit of 6", async () => {
    mockLimit.mockResolvedValue([]);

    await listRecentlyUpdatedCounters();

    expect(mockLimit).toHaveBeenCalledWith(6);
  });
});

describe("updateCounter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
  });

  it("keeps isPublic in sync when visibilityMode becomes public_readonly", async () => {
    const counter = makeCounter({ visibilityMode: "public_readonly" });
    mockUpdateReturning.mockResolvedValue([counter]);

    const result = await updateCounter(counter.id, {
      visibilityMode: "public_readonly",
    });

    expect(result).toEqual(counter);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        isPublic: 1,
        visibilityMode: "public_readonly",
      }),
    );
  });

  it("updates counterMode when provided", async () => {
    const counter = makeCounter({ counterMode: "decrement_only" });
    mockUpdateReturning.mockResolvedValue([counter]);

    await updateCounter(counter.id, { counterMode: "decrement_only" });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ counterMode: "decrement_only" }),
    );
  });

  it("does not include counterMode when not provided", async () => {
    const counter = makeCounter();
    mockUpdateReturning.mockResolvedValue([counter]);

    await updateCounter(counter.id, { title: "Updated" });

    const setArg = mockUpdateSet.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("counterMode");
  });

  it("sets lastActivityAt as a Date on every update", async () => {
    const counter = makeCounter();
    mockUpdateReturning.mockResolvedValue([counter]);

    await updateCounter(counter.id, { title: "Refreshed" });

    const setArg = mockUpdateSet.mock.calls[0][0];
    expect(setArg.lastActivityAt).toBeInstanceOf(Date);
  });
});

describe("incrementCounter", () => {
  const txInsert = vi.fn();
  const txUpdate = vi.fn();

  function runWithCount(count: number) {
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => Promise.resolve([makeCounter({ count })]),
          }),
        }),
      }),
      insert: txInsert,
      update: txUpdate,
    };
    mockTransaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an increment that would exceed the int4 maximum", async () => {
    runWithCount(INT4_MAX);

    await expect(incrementCounter("c1", 1)).rejects.toBeInstanceOf(
      CounterOverflowError,
    );
    expect(txInsert).not.toHaveBeenCalled();
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("rejects a decrement that would go below the int4 minimum", async () => {
    runWithCount(INT4_MIN + 5);

    await expect(incrementCounter("c1", -6)).rejects.toBeInstanceOf(
      CounterOverflowError,
    );
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("rejects a large delta from a mid-range value", async () => {
    runWithCount(1_500_000_000);

    await expect(
      incrementCounter("c1", 1_000_000_000),
    ).rejects.toBeInstanceOf(CounterOverflowError);
  });
});

describe("getCounterSparkline", () => {
  function dayString(n: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function setupExecuteMock(rows: { day: string; value: number }[]) {
    vi.clearAllMocks();
    sparklineCache.clear();
    mockExecute.mockResolvedValue(rows);
  }

  it("returns one point per day from creation to today", async () => {
    setupExecuteMock([
      { day: dayString(3), value: 0 },
      { day: dayString(2), value: 1 },
      { day: dayString(1), value: 5 },
      { day: dayString(0), value: 5 },
    ]);

    const result = await getCounterSparkline("test-id");

    expect(result).toHaveLength(4);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBe(1);
    expect(result[2].value).toBe(5);
    expect(result[3].value).toBe(5);
  });

  it("returns 1 point for brand new counter with no history", async () => {
    setupExecuteMock([{ day: dayString(0), value: 0 }]);

    const result = await getCounterSparkline("test-id");

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(0);
  });

  it("returns 1 point for new counter with same-day history", async () => {
    setupExecuteMock([{ day: dayString(0), value: 5 }]);

    const result = await getCounterSparkline("test-id");

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(5);
  });

  it("returns empty array when counter not found", async () => {
    setupExecuteMock([]);

    const result = await getCounterSparkline("test-id");

    expect(result).toEqual([]);
  });

  it("carries forward last known value for days without activity", async () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      day: dayString(10 - i),
      value: i >= 5 ? 42 : 0,
    }));
    setupExecuteMock(rows);

    const result = await getCounterSparkline("test-id");

    expect(result).toHaveLength(11);
    expect(result[0].value).toBe(0);
    for (let i = 1; i <= 4; i++) {
      expect(result[i].value).toBe(0);
    }
    for (let i = 5; i <= 10; i++) {
      expect(result[i].value).toBe(42);
    }
  });

  it("produces daily entries even with multiple changes per day", async () => {
    setupExecuteMock([
      { day: dayString(5), value: 0 },
      { day: dayString(4), value: 10 },
      { day: dayString(3), value: 20 },
      { day: dayString(2), value: 30 },
      { day: dayString(1), value: 30 },
      { day: dayString(0), value: 60 },
    ]);

    const result = await getCounterSparkline("test-id");

    expect(result).toHaveLength(6);
    expect(result[0].value).toBe(0);
    expect(result[result.length - 1].value).toBe(60);
  });

  it("uses cache on second call", async () => {
    setupExecuteMock([{ day: dayString(0), value: 7 }]);

    await getCounterSparkline("cached-id");
    const result = await getCounterSparkline("cached-id");

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(7);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});

describe("getGlobalActionCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it("returns 0 when no counters exist", async () => {
    mockFrom.mockResolvedValue([{ total: "0" }]);

    const result = await getGlobalActionCount();

    expect(result).toBe(0);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
  });

  it("returns correct sum when counters exist", async () => {
    mockFrom.mockResolvedValue([{ total: "42" }]);

    const result = await getGlobalActionCount();

    expect(result).toBe(42);
  });

  it("returns correct sum with multiple counters", async () => {
    mockFrom.mockResolvedValue([{ total: "150" }]);

    const result = await getGlobalActionCount();

    expect(result).toBe(150);
  });
});

describe("listAllCounters", () => {
  const mockLeftJoin = vi.fn();
  const mockOffset = vi.fn();
  const mockCountFrom = vi.fn();
  const mockCountWhere = vi.fn();

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

  it("returns counters with ownerName from username", async () => {
    const counter = makeCounter({ title: "Test" });
    mockOffset.mockResolvedValue([
      { counter, ownerUsername: "johndoe", ownerDisplayName: "John Doe" },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 1 }]);

    const result = await listAllCounters();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].ownerName).toBe("johndoe");
    expect(result.items[0].title).toBe("Test");
  });

  it("never falls back to the full name when username is null", async () => {
    const counter = makeCounter({ title: "Fallback" });
    mockOffset.mockResolvedValue([
      { counter, ownerUsername: null, ownerDisplayName: "John Doe" },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 1 }]);

    const result = await listAllCounters();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].ownerName).toBeNull();
    expect(JSON.stringify(result)).not.toContain("John Doe");
  });

  it("does not select users.name", async () => {
    mockOffset.mockResolvedValue([]);
    mockCountWhere.mockResolvedValue([{ total: 0 }]);

    await listAllCounters();

    const selection = mockSelect.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.values(selection)).not.toContain(users.name);
  });

  it("returns ownerName as null when no owner exists", async () => {
    const counter = makeCounter({ title: "No Owner" });
    mockOffset.mockResolvedValue([
      { counter, ownerUsername: null, ownerDisplayName: null },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 1 }]);

    const result = await listAllCounters();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].ownerName).toBeNull();
  });

  it("returns the total count", async () => {
    const counter = makeCounter();
    mockOffset.mockResolvedValue([
      { counter, ownerUsername: "user1", ownerDisplayName: null },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 42 }]);

    const result = await listAllCounters();

    expect(result.total).toBe(42);
  });
});

describe("getCounterCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it("returns 0 when no counters exist", async () => {
    mockFrom.mockResolvedValue([{ count: "0" }]);

    const result = await getCounterCount();

    expect(result).toBe(0);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
  });

  it("returns correct count when counters exist", async () => {
    mockFrom.mockResolvedValue([{ count: "5" }]);

    const result = await getCounterCount();

    expect(result).toBe(5);
  });

  it("returns a number even though the DB returns a string", async () => {
    mockFrom.mockResolvedValue([{ count: "123" }]);

    const result = await getCounterCount();

    expect(typeof result).toBe("number");
    expect(result).toBe(123);
  });
});

describe("getOwnedCounterCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
  });

  it("returns the count of owned counters", async () => {
    mockWhere.mockResolvedValue([{ count: "3" }]);

    const result = await getOwnedCounterCount("user-1");

    expect(result).toBe(3);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledOnce();
  });

  it("returns 0 when user owns no counters", async () => {
    mockWhere.mockResolvedValue([{ count: "0" }]);

    const result = await getOwnedCounterCount("user-1");

    expect(result).toBe(0);
  });

  it("returns 0 when row is undefined", async () => {
    mockWhere.mockResolvedValue([]);

    const result = await getOwnedCounterCount("user-1");

    expect(result).toBe(0);
  });

  it("excludes team counters created by the user", async () => {
    mockWhere.mockResolvedValue([{ count: "1" }]);

    await getOwnedCounterCount("user-1");

    const where = toSql(mockWhere.mock.calls[0][0]);
    expect(where).toContain('"counters"."owner_id" = $1');
    expect(where).toContain('"counters"."team_id" is null');
  });
});

describe("getUserCounters", () => {
  const itemsFrom = vi.fn();
  const itemsLeftJoin = vi.fn();
  const itemsWhere = vi.fn();
  const itemsOrderBy = vi.fn();
  const itemsLimit = vi.fn();
  const itemsOffset = vi.fn();
  const countFrom = vi.fn();
  const countLeftJoin = vi.fn();
  const countWhere = vi.fn();

  function setup(rows: unknown[], total: number) {
    mockSelect
      .mockReturnValueOnce({ from: itemsFrom })
      .mockReturnValueOnce({ from: countFrom });
    itemsFrom.mockReturnValue({ leftJoin: itemsLeftJoin });
    itemsLeftJoin.mockReturnValue({
      leftJoin: itemsLeftJoin,
      where: itemsWhere,
    });
    itemsWhere.mockReturnValue({ orderBy: itemsOrderBy });
    itemsOrderBy.mockReturnValue({
      $dynamic: () =>
        Object.assign(Promise.resolve(rows), { limit: itemsLimit }),
    });
    itemsLimit.mockReturnValue({ offset: itemsOffset });
    itemsOffset.mockResolvedValue(rows);
    countFrom.mockReturnValue({ leftJoin: countLeftJoin });
    countLeftJoin.mockReturnValue({
      leftJoin: countLeftJoin,
      where: countWhere,
    });
    countWhere.mockResolvedValue([{ total }]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes counters owned by the user's teams with team info", async () => {
    const personal = { ...makeCounter({ ownerId: "user-1" }), teamName: null };
    const teamCounter = {
      ...makeCounter({ ownerId: "user-2", teamId: "team-1" }),
      teamName: "Alpha",
    };
    setup([personal, teamCounter], 2);

    const result = await getUserCounters("user-1");

    expect(result).toEqual({ items: [personal, teamCounter], total: 2 });
    expect(itemsLeftJoin).toHaveBeenCalledWith(teamMembers, expect.anything());
    expect(itemsLeftJoin).toHaveBeenCalledWith(teams, expect.anything());

    const where = toSql(itemsWhere.mock.calls[0][0]);
    expect(where).toContain('"team_members"."user_id" is not null');
    expect(where).toContain('"counter_members"."user_id" is not null');
    expect(where).toContain('"counters"."team_id" is null');
    expect(toSql(countWhere.mock.calls[0][0])).toBe(where);
  });

  it("paginates in SQL and returns the full total", async () => {
    setup([{ ...makeCounter(), teamName: null }], 30);

    const result = await getUserCounters("user-1", 12, 24);

    expect(itemsLimit).toHaveBeenCalledWith(12);
    expect(itemsOffset).toHaveBeenCalledWith(24);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(30);
  });

  it("returns all rows when no limit is given", async () => {
    setup([], 0);

    const result = await getUserCounters("user-1");

    expect(itemsLimit).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], total: 0 });
  });
});

describe("getSharedCounters", () => {
  const itemsFrom = vi.fn();
  const itemsLeftJoin = vi.fn();
  const itemsWhere = vi.fn();
  const itemsOrderBy = vi.fn();
  const itemsLimit = vi.fn();
  const itemsOffset = vi.fn();
  const countFrom = vi.fn();
  const countLeftJoin = vi.fn();
  const countWhere = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect
      .mockReturnValueOnce({ from: itemsFrom })
      .mockReturnValueOnce({ from: countFrom });
    itemsFrom.mockReturnValue({ leftJoin: itemsLeftJoin });
    itemsLeftJoin.mockReturnValue({
      leftJoin: itemsLeftJoin,
      where: itemsWhere,
    });
    itemsWhere.mockReturnValue({ orderBy: itemsOrderBy });
    itemsOrderBy.mockReturnValue({ limit: itemsLimit });
    itemsLimit.mockReturnValue({ offset: itemsOffset });
    countFrom.mockReturnValue({ leftJoin: countLeftJoin });
    countLeftJoin.mockReturnValue({
      leftJoin: countLeftJoin,
      where: countWhere,
    });
  });

  it("returns direct and team counters with the effective member role", async () => {
    const direct = makeCounter({ ownerId: "user-2" });
    const team = makeCounter({ ownerId: "user-1", teamId: "team-1" });
    const both = makeCounter({ teamId: "team-1" });
    itemsOffset.mockResolvedValue([
      { ...direct, teamName: null, directRole: "editor", teamRole: null },
      {
        ...team,
        teamName: "Alpha",
        directRole: null,
        teamRole: "incrementer",
      },
      { ...both, teamName: "Alpha", directRole: "viewer", teamRole: "owner" },
    ]);
    countWhere.mockResolvedValue([{ total: 3 }]);

    const result = await getSharedCounters("user-1");

    expect(result.total).toBe(3);
    expect(result.items).toEqual([
      { ...direct, teamName: null, memberRole: "editor" },
      { ...team, teamName: "Alpha", memberRole: "incrementer" },
      { ...both, teamName: "Alpha", memberRole: "admin" },
    ]);
  });

  it("excludes only personally owned counters", async () => {
    itemsOffset.mockResolvedValue([]);
    countWhere.mockResolvedValue([{ total: 0 }]);

    await getSharedCounters("user-1", 4);

    const where = toSql(itemsWhere.mock.calls[0][0]);
    expect(where).toContain('"counters"."team_id" is not null');
    expect(where).toContain('"counters"."owner_id" IS DISTINCT FROM $1');
    expect(where).toContain('"team_members"."user_id" is not null');
    expect(itemsLimit).toHaveBeenCalledWith(4);
  });
});

describe("share token exposure", () => {
  const SECRET = "secret-token-value";

  function expectNoShareToken(selection: unknown) {
    expect(selection).toBeTypeOf("object");
    expect(selection).not.toHaveProperty("shareToken");
    expect(Object.values(selection as object)).not.toContain(
      countersTable.shareToken,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listRecentlyCreatedCounters selects columns without shareToken", async () => {
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);

    await listRecentlyCreatedCounters();

    expectNoShareToken(mockSelect.mock.calls[0][0]);
  });

  it("listRecentlyUpdatedCounters selects columns without shareToken", async () => {
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);

    await listRecentlyUpdatedCounters();

    expectNoShareToken(mockSelect.mock.calls[0][0]);
  });

  it("listPublicCounters selects columns without shareToken", async () => {
    const offset = vi.fn().mockResolvedValue([]);
    const countWhere = vi.fn().mockResolvedValue([{ total: 0 }]);
    mockSelect
      .mockReturnValueOnce({
        from: () => ({
          groupBy: () => ({
            as: () => ({
              counterId: counterHistory.counterId,
              actionCount: counterHistory.id,
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
      .mockReturnValueOnce({ from: () => ({ where: countWhere }) });

    await listPublicCounters();

    expectNoShareToken(mockSelect.mock.calls[1][0]);
  });

  it("getOwnedCounters selects columns without shareToken", async () => {
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

    await getOwnedCounters("user-1");

    expectNoShareToken(mockSelect.mock.calls[0][0]);
  });

  it("listAllCounters strips shareToken from joined rows", async () => {
    const offset = vi.fn().mockResolvedValue([
      {
        counter: makeCounter({ visibilityMode: "private", shareToken: SECRET }),
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

    const result = await listAllCounters();

    expect(result.items[0]).not.toHaveProperty("shareToken");
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});

describe("updateCounter share token lifecycle", () => {
  function existingCounter(overrides: Partial<Counter>) {
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValueOnce([makeCounter(overrides)]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockUpdateReturning.mockResolvedValue([makeCounter()]);
  });

  it("clears the token when switching private to public", async () => {
    await updateCounter("c1", { visibilityMode: "public" });

    expect(mockUpdateSet.mock.calls[0][0]).toMatchObject({
      visibilityMode: "public",
      shareToken: null,
    });
  });

  it("clears the token when switching private to public_readonly", async () => {
    await updateCounter("c1", { visibilityMode: "public_readonly" });

    expect(mockUpdateSet.mock.calls[0][0].shareToken).toBeNull();
  });

  it("clears the token when the legacy isPublic flag is set", async () => {
    await updateCounter("c1", { isPublic: true });

    expect(mockUpdateSet.mock.calls[0][0].shareToken).toBeNull();
  });

  it("generates a new token when switching public to private", async () => {
    existingCounter({ visibilityMode: "public", shareToken: null });

    await updateCounter("c1", { visibilityMode: "private" });

    expect(mockUpdateSet.mock.calls[0][0].shareToken).toMatch(
      /^[0-9a-f]{32}$/,
    );
  });

  it("replaces a stale token left on a non-private counter", async () => {
    existingCounter({ visibilityMode: "public", shareToken: "stale-token" });

    await updateCounter("c1", { visibilityMode: "private" });

    const next = mockUpdateSet.mock.calls[0][0].shareToken;
    expect(next).toMatch(/^[0-9a-f]{32}$/);
    expect(next).not.toBe("stale-token");
  });

  it("keeps the existing token when staying private", async () => {
    existingCounter({ visibilityMode: "private", shareToken: "keep-me" });

    await updateCounter("c1", { visibilityMode: "private" });

    expect(mockUpdateSet.mock.calls[0][0]).not.toHaveProperty("shareToken");
  });

  it("does not touch the token when visibility is not updated", async () => {
    await updateCounter("c1", { title: "Renamed" });

    expect(mockUpdateSet.mock.calls[0][0]).not.toHaveProperty("shareToken");
  });
});

describe("regenerateCounterShareToken", () => {
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

  it("stores a fresh token and removes followers for private counters", async () => {
    useTx([{ visibilityMode: "private" }], [{ id: 1 }, { id: 2 }]);

    const first = await regenerateCounterShareToken("c1");
    const second = await regenerateCounterShareToken("c1");

    expect(first).toMatchObject({ ok: true, removedFollowers: 2 });
    if (!first.ok || !second.ok) throw new Error("expected success");
    expect(first.shareToken).toMatch(/^[0-9a-f]{32}$/);
    expect(second.shareToken).not.toBe(first.shareToken);
    expect(txSet).toHaveBeenCalledWith({ shareToken: first.shareToken });
  });

  it.each(["public", "public_readonly"])(
    "refuses %s counters without writing",
    async (visibilityMode) => {
      useTx([{ visibilityMode }]);

      await expect(regenerateCounterShareToken("c1")).resolves.toEqual({
        ok: false,
        reason: "not_private",
      });
      expect(txSet).not.toHaveBeenCalled();
    },
  );

  it("reports a missing counter", async () => {
    useTx([]);

    await expect(regenerateCounterShareToken("c1")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(txSet).not.toHaveBeenCalled();
  });
});
