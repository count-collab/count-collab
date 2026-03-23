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
  listRecentlyCreatedCounters,
  listRecentlyUpdatedCounters,
} from "./counters";

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: crypto.randomUUID(),
    title: "Test Counter",
    description: null,
    count: 0,
    isPublic: 1,
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
