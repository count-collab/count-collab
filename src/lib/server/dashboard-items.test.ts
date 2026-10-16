import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDeleteWhere = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockTransaction = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    delete: () => ({ where: mockDeleteWhere }),
    update: () => ({ set: mockUpdateSet }),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  addDashboardItem,
  MAX_DASHBOARD_ITEMS,
  moveDashboardItem,
  removeDashboardItem,
  resizeDashboardItem,
} from "./dashboard-items";

const dialect = new PgDialect();
const DASHBOARD_ID = "2f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function toQuery(clause: unknown) {
  return dialect.sqlToQuery(clause as SQL);
}

function expectScoped(clause: unknown, itemId: number) {
  const { sql, params } = toQuery(clause);
  expect(sql).toContain('"dashboard_items"."id"');
  expect(sql).toContain('"dashboard_items"."dashboard_id"');
  expect(params).toEqual([itemId, DASHBOARD_ID]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
});

describe("removeDashboardItem", () => {
  it("filters by both item id and dashboard id", async () => {
    mockDeleteWhere.mockReturnValue({ returning: async () => [{ id: 5 }] });

    await expect(removeDashboardItem(DASHBOARD_ID, 5)).resolves.toBe(true);
    expectScoped(mockDeleteWhere.mock.calls[0][0], 5);
  });

  it("returns false when the item belongs to another dashboard", async () => {
    mockDeleteWhere.mockReturnValue({ returning: async () => [] });

    await expect(removeDashboardItem(DASHBOARD_ID, 5)).resolves.toBe(false);
  });
});

describe("moveDashboardItem", () => {
  it("filters by both item id and dashboard id", async () => {
    mockUpdateWhere.mockReturnValue({ returning: async () => [{ id: 5 }] });

    await moveDashboardItem(DASHBOARD_ID, 5, 1, 2);
    expectScoped(mockUpdateWhere.mock.calls[0][0], 5);
  });

  it("returns null when no row matched", async () => {
    mockUpdateWhere.mockReturnValue({ returning: async () => [] });

    await expect(moveDashboardItem(DASHBOARD_ID, 5, 1, 2)).resolves.toBeNull();
  });
});

describe("resizeDashboardItem", () => {
  it("filters by both item id and dashboard id", async () => {
    mockUpdateWhere.mockReturnValue({ returning: async () => [{ id: 5 }] });

    await resizeDashboardItem(DASHBOARD_ID, 5, 2, 2);
    expectScoped(mockUpdateWhere.mock.calls[0][0], 5);
  });

  it("returns null when no row matched", async () => {
    mockUpdateWhere.mockReturnValue({ returning: async () => [] });

    await expect(
      resizeDashboardItem(DASHBOARD_ID, 5, 2, 2),
    ).resolves.toBeNull();
  });
});

describe("addDashboardItem", () => {
  const insertReturning = vi.fn();

  function runWithItemCount(total: number) {
    const lockQuery = { for: async () => [] };
    const countQuery = Promise.resolve([{ total }]);
    let selects = 0;
    const tx = {
      select: () => ({
        from: () => ({
          where: () => (selects++ === 0 ? lockQuery : countQuery),
        }),
      }),
      insert: () => ({ values: () => ({ returning: insertReturning }) }),
    };
    mockTransaction.mockImplementation((fn: (t: unknown) => unknown) => fn(tx));
  }

  it("inserts while under the item cap", async () => {
    runWithItemCount(MAX_DASHBOARD_ITEMS - 1);
    insertReturning.mockResolvedValue([{ id: 9 }]);

    await expect(
      addDashboardItem(DASHBOARD_ID, "counter-1", 0, 0),
    ).resolves.toEqual({ id: 9 });
  });

  it("returns null without inserting at the item cap", async () => {
    runWithItemCount(MAX_DASHBOARD_ITEMS);

    await expect(
      addDashboardItem(DASHBOARD_ID, "counter-1", 0, 0),
    ).resolves.toBeNull();
    expect(insertReturning).not.toHaveBeenCalled();
  });
});
