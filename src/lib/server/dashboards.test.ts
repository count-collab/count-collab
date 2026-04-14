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

import { listAllDashboards } from "./dashboards";

function makeDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
    return {
        id: crypto.randomUUID(),
        title: "Test Dashboard",
        description: null,
        visibilityMode: "public",
        shareToken: null,
        ownerId: null,
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
