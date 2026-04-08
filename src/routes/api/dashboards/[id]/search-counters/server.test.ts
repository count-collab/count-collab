import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCanEditDashboard = vi.fn();
const mockGetDashboardItems = vi.fn();
const mockEscapeLikePattern = vi.fn((v: string) => v);
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockDbSubSelect = vi.fn();
const mockSubFrom = vi.fn();
const mockSubWhere = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("$lib/db/schema", () => ({
  counters: {
    id: "counters.id",
    title: "counters.title",
    description: "counters.description",
    count: "counters.count",
    visibilityMode: "counters.visibilityMode",
    ownerId: "counters.ownerId",
    updatedAt: "counters.updatedAt",
  },
  counterMembers: {
    counterId: "counterMembers.counterId",
    userId: "counterMembers.userId",
  },
}));

vi.mock("$lib/server/dashboard-authorize", () => ({
  canEditDashboard: (...args: unknown[]) => mockCanEditDashboard(...args),
}));

vi.mock("$lib/server/dashboard-items", () => ({
  getDashboardItems: (...args: unknown[]) => mockGetDashboardItems(...args),
}));

vi.mock("$lib/server/crypto", () => ({
  escapeLikePattern: (v: string) => mockEscapeLikePattern(v),
}));

vi.mock("$lib/utils/validation", () => ({
  dashboardIdSchema: {
    safeParse: (val: string) => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(val)
        ? { success: true, data: val }
        : { success: false };
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => ({ desc: col })),
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  ilike: vi.fn((col: unknown, pattern: unknown) => ({
    ilike: [col, pattern],
  })),
  inArray: vi.fn((col: unknown, arr: unknown) => ({ inArray: [col, arr] })),
  notInArray: vi.fn((col: unknown, arr: unknown) => ({
    notInArray: [col, arr],
  })),
  or: vi.fn((...args: unknown[]) => ({ or: args })),
}));

import { GET } from "./+server";

const VALID_DASHBOARD_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(
  id: string,
  overrides: Record<string, unknown> = {},
): unknown {
  const url = new URL(`http://localhost/api/dashboards/${id}/search-counters`);
  return {
    params: { id },
    locals: makeLocals(null),
    url,
    ...overrides,
  };
}

function setupDbChain(results: unknown[] = []) {
  mockLimit.mockResolvedValue(results);
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockWhere.mockReturnValue({ orderBy: mockOrderBy });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });

  // For the membership subquery
  mockSubWhere.mockReturnValue([]);
  mockSubFrom.mockReturnValue({ where: mockSubWhere });
  mockDbSubSelect.mockReturnValue({ from: mockSubFrom });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanEditDashboard.mockResolvedValue(true);
  mockGetDashboardItems.mockResolvedValue([]);
  setupDbChain([]);
});

describe("GET /api/dashboards/[id]/search-counters", () => {
  it("returns 400 for invalid dashboard ID format", async () => {
    await expect(GET(makeEvent("not-a-uuid") as any)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    await expect(
      GET(makeEvent(VALID_DASHBOARD_ID) as any),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 401 when session has no user ID", async () => {
    const locals = {
      auth: vi.fn(async () => ({ user: {} })),
    };
    await expect(
      GET(makeEvent(VALID_DASHBOARD_ID, { locals }) as any),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 403 when user cannot edit the dashboard", async () => {
    mockCanEditDashboard.mockResolvedValue(false);

    await expect(
      GET(
        makeEvent(VALID_DASHBOARD_ID, {
          locals: makeLocals("user-1"),
        }) as any,
      ),
    ).rejects.toMatchObject({
      status: 403,
    });

    expect(mockCanEditDashboard).toHaveBeenCalledWith(
      "user-1",
      VALID_DASHBOARD_ID,
    );
  });

  it("returns matching counters on happy path", async () => {
    const mockCounters = [
      {
        id: "counter-1",
        title: "My Counter",
        description: "desc",
        count: 5,
        visibilityMode: "public",
      },
      {
        id: "counter-2",
        title: "Another Counter",
        description: "",
        count: 10,
        visibilityMode: "public",
      },
    ];
    setupDbChain(mockCounters);

    const response = await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
        url: new URL(
          `http://localhost/api/dashboards/${VALID_DASHBOARD_ID}/search-counters?q=counter`,
        ),
      }) as any,
    );
    const body = await response.json();

    expect(body.items).toHaveLength(2);
    expect(body.items[0].id).toBe("counter-1");
    expect(body.items[1].id).toBe("counter-2");
    expect(body.userId).toBe("user-1");
  });

  it("returns empty array when no counters match", async () => {
    setupDbChain([]);

    const response = await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
        url: new URL(
          `http://localhost/api/dashboards/${VALID_DASHBOARD_ID}/search-counters?q=nonexistent`,
        ),
      }) as any,
    );
    const body = await response.json();

    expect(body.items).toEqual([]);
  });

  it("passes search query through escapeLikePattern", async () => {
    setupDbChain([]);

    await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
        url: new URL(
          `http://localhost/api/dashboards/${VALID_DASHBOARD_ID}/search-counters?q=test%25query`,
        ),
      }) as any,
    );

    expect(mockEscapeLikePattern).toHaveBeenCalledWith("test%query");
  });

  it("excludes counters already in the dashboard", async () => {
    mockGetDashboardItems.mockResolvedValue([
      { counterId: "existing-counter-1" },
      { counterId: "existing-counter-2" },
    ]);
    setupDbChain([]);

    const { notInArray } = await import("drizzle-orm");

    await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
      }) as any,
    );

    expect(notInArray).toHaveBeenCalledWith("counters.id", [
      "existing-counter-1",
      "existing-counter-2",
    ]);
  });

  it("does not add notInArray condition when dashboard has no items", async () => {
    mockGetDashboardItems.mockResolvedValue([]);
    setupDbChain([]);

    const { notInArray } = await import("drizzle-orm");

    await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
      }) as any,
    );

    expect(notInArray).not.toHaveBeenCalled();
  });

  it("respects limit parameter clamped to max 20", async () => {
    setupDbChain([]);

    await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
        url: new URL(
          `http://localhost/api/dashboards/${VALID_DASHBOARD_ID}/search-counters?limit=50`,
        ),
      }) as any,
    );

    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it("respects limit parameter clamped to min 1", async () => {
    setupDbChain([]);

    await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
        url: new URL(
          `http://localhost/api/dashboards/${VALID_DASHBOARD_ID}/search-counters?limit=-5`,
        ),
      }) as any,
    );

    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it("defaults limit to 10 when not provided", async () => {
    setupDbChain([]);

    await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
      }) as any,
    );

    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it("handles empty search query gracefully", async () => {
    setupDbChain([]);

    const { ilike } = await import("drizzle-orm");

    await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
        url: new URL(
          `http://localhost/api/dashboards/${VALID_DASHBOARD_ID}/search-counters?q=`,
        ),
      }) as any,
    );

    expect(ilike).not.toHaveBeenCalled();
  });

  it("handles whitespace-only search query as empty", async () => {
    setupDbChain([]);

    const { ilike } = await import("drizzle-orm");

    await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
        url: new URL(
          `http://localhost/api/dashboards/${VALID_DASHBOARD_ID}/search-counters?q=%20%20%20`,
        ),
      }) as any,
    );

    expect(ilike).not.toHaveBeenCalled();
  });
});
