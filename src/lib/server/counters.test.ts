import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Counter } from "$lib/db/schema";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Chain: db.select().from().where().orderBy().limit()
mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({ orderBy: mockOrderBy });
mockOrderBy.mockReturnValue({ limit: mockLimit });

import {
  generateShareToken,
  getCounterSparkline,
  listRecentlyCreatedCounters,
  listRecentlyUpdatedCounters,
  sparklineCache,
} from "./counters";

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: crypto.randomUUID(),
    title: "Test Counter",
    description: null,
    count: 0,
    isPublic: 1,
    shareToken: null,
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

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

describe("getCounterSparkline", () => {
  function makeHistoryRow(value: number, date: Date) {
    return { newValue: value, changedAt: date };
  }

  function minutesAgo(n: number): Date {
    return new Date(Date.now() - n * 60 * 1000);
  }

  function daysAgo(n: number): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    d.setUTCHours(12, 0, 0, 0);
    return d;
  }

  function setupMocks(
    counterResult: { createdAt: Date; count: number } | null,
    historyRows: ReturnType<typeof makeHistoryRow>[],
  ) {
    vi.clearAllMocks();
    sparklineCache.clear();

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const counterWhere = vi
          .fn()
          .mockResolvedValue(counterResult ? [counterResult] : []);
        const counterFrom = vi.fn().mockReturnValue({ where: counterWhere });
        return { from: counterFrom };
      }
      const historyLimit = vi.fn().mockResolvedValue(historyRows);
      const historyOrderBy = vi.fn().mockReturnValue({ limit: historyLimit });
      const historyWhere = vi.fn().mockReturnValue({ orderBy: historyOrderBy });
      const historyFrom = vi.fn().mockReturnValue({ where: historyWhere });
      return { from: historyFrom };
    });
  }

  it("returns raw points with creation start and now end", async () => {
    const createdAt = daysAgo(3);
    const rows = [makeHistoryRow(5, daysAgo(1)), makeHistoryRow(1, daysAgo(2))];
    setupMocks({ createdAt, count: 5 }, rows);

    const result = await getCounterSparkline("test-id");

    // creation + 2 history = 3 points
    expect(result).toHaveLength(3);
    expect(result[0].value).toBe(0); // creation
    expect(result[1].value).toBe(1);
    expect(result[2].value).toBe(5);
  });

  it("returns 2 points for brand new counter with no history", async () => {
    const createdAt = minutesAgo(1);
    setupMocks({ createdAt, count: 0 }, []);

    const result = await getCounterSparkline("test-id");

    // creation only = 1 point
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(0);
  });

  it("returns 3 points for new counter with same-minute history", async () => {
    const createdAt = minutesAgo(2);
    const rows = [makeHistoryRow(5, minutesAgo(1))];
    setupMocks({ createdAt, count: 5 }, rows);

    const result = await getCounterSparkline("test-id");

    // creation + 1 history = 2 points
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBe(5);
  });

  it("returns empty array when counter not found", async () => {
    setupMocks(null, []);

    const result = await getCounterSparkline("test-id");

    expect(result).toEqual([]);
  });

  it("trailing point carries last known value", async () => {
    const createdAt = daysAgo(10);
    const rows = [makeHistoryRow(42, daysAgo(5))];
    setupMocks({ createdAt, count: 42 }, rows);

    const result = await getCounterSparkline("test-id");

    expect(result).toHaveLength(2);
    expect(result[1].value).toBe(42);
  });

  it("samples when points exceed maxPoints", async () => {
    const createdAt = daysAgo(101);
    const rows = Array.from({ length: 100 }, (_, i) =>
      makeHistoryRow(100 - i, daysAgo(i + 1)),
    );
    setupMocks({ createdAt, count: 100 }, rows);

    const result = await getCounterSparkline("test-id", 10);

    expect(result).toHaveLength(10);
    expect(result[0].value).toBe(0); // creation point preserved
    expect(result[9].value).toBe(100); // last history point preserved
  });
});

describe("generateShareToken", () => {
  it("returns a 32-character hex string", () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("returns unique tokens on each call", () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => generateShareToken()),
    );
    expect(tokens.size).toBe(50);
  });
});
