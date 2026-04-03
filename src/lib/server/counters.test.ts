import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Counter } from "$lib/db/schema";

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

vi.mock("$lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
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
  createCounter,
  getCounterCount,
  getCounterSparkline,
  getGlobalCounterSum,
  listAllCounters,
  listRecentlyCreatedCounters,
  listRecentlyUpdatedCounters,
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
    shareToken: null,
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
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

describe("getGlobalCounterSum", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it("returns 0 when no counters exist", async () => {
    mockFrom.mockResolvedValue([{ total: "0" }]);

    const result = await getGlobalCounterSum();

    expect(result).toBe(0);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
  });

  it("returns correct sum when counters exist", async () => {
    mockFrom.mockResolvedValue([{ total: "42" }]);

    const result = await getGlobalCounterSum();

    expect(result).toBe(42);
  });

  it("returns correct sum with multiple counters", async () => {
    mockFrom.mockResolvedValue([{ total: "150" }]);

    const result = await getGlobalCounterSum();

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

  it("returns counters with ownerName falling back to display name when username is null", async () => {
    const counter = makeCounter({ title: "Fallback" });
    mockOffset.mockResolvedValue([
      { counter, ownerUsername: null, ownerDisplayName: "John Doe" },
    ]);
    mockCountWhere.mockResolvedValue([{ total: 1 }]);

    const result = await listAllCounters();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].ownerName).toBe("John Doe");
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
