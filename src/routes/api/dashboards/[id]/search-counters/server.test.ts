import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCanEditDashboard = vi.fn();
const mockGetDashboardItems = vi.fn();
const mockEscapeLikePattern = vi.fn((v: string) => v);
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockLeftJoin = vi.fn();
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
    teamId: "counters.teamId",
    updatedAt: "counters.updatedAt",
  },
  counterMembers: {
    counterId: "counterMembers.counterId",
    userId: "counterMembers.userId",
  },
  teamMembers: {
    teamId: "teamMembers.teamId",
    userId: "teamMembers.userId",
  },
  teams: {
    id: "teams.id",
    name: "teams.name",
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

vi.mock("$lib/utils/validation", async () => {
  const { z } = await import("zod");
  return {
    dashboardIdSchema: {
      safeParse: (val: string) => {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(val)
          ? { success: true, data: val }
          : { success: false };
      },
    },
    dashboardCounterSearchScopeSchema: z
      .enum(["all", "mine", "others"])
      .default("all"),
  };
});

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => ({ desc: col })),
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  ilike: vi.fn((col: unknown, pattern: unknown) => ({
    ilike: [col, pattern],
  })),
  inArray: vi.fn((col: unknown, arr: unknown) => ({ inArray: [col, arr] })),
  isNotNull: vi.fn((col: unknown) => ({ isNotNull: col })),
  isNull: vi.fn((col: unknown) => ({ isNull: col })),
  ne: vi.fn((a: unknown, b: unknown) => ({ ne: [a, b] })),
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
  mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
  mockFrom.mockReturnValue({ where: mockWhere, leftJoin: mockLeftJoin });
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

  it("includes team counters with team info and marks accessible ones as mine", async () => {
    setupDbChain([
      {
        id: "team-counter",
        title: "Team Counter",
        description: null,
        count: 3,
        visibilityMode: "private",
        ownerId: "someone-else",
        teamId: "team-1",
        teamName: "Alpha",
        teamMemberUserId: "user-1",
      },
      {
        id: "created-for-team",
        title: "Created For Other Team",
        description: null,
        count: 2,
        visibilityMode: "public",
        ownerId: "user-1",
        teamId: "team-2",
        teamName: "Beta",
        teamMemberUserId: null,
      },
      {
        id: "personal",
        title: "Personal",
        description: null,
        count: 1,
        visibilityMode: "private",
        ownerId: "user-1",
        teamId: null,
        teamName: null,
        teamMemberUserId: null,
      },
    ]);

    const { isNotNull } = await import("drizzle-orm");

    const response = await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
      }) as any,
    );
    const body = await response.json();

    expect(isNotNull).toHaveBeenCalledWith("teamMembers.userId");
    expect(body.items[0]).toEqual({
      id: "team-counter",
      title: "Team Counter",
      description: null,
      count: 3,
      visibilityMode: "private",
      ownerId: "someone-else",
      teamId: "team-1",
      teamName: "Alpha",
      isMine: true,
      onDashboard: false,
    });
    expect(body.items[1].isMine).toBe(false);
    expect(body.items[2].isMine).toBe(true);
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

  it("returns counters already on the dashboard flagged with onDashboard", async () => {
    mockGetDashboardItems.mockResolvedValue([
      { counterId: "existing-counter-1" },
      { counterId: "existing-counter-2" },
    ]);
    setupDbChain([
      {
        id: "existing-counter-1",
        title: "A",
        teamId: null,
        ownerId: null,
        teamMemberUserId: null,
      },
      {
        id: "new-counter",
        title: "B",
        teamId: null,
        ownerId: null,
        teamMemberUserId: null,
      },
      {
        id: "existing-counter-2",
        title: "C",
        teamId: null,
        ownerId: null,
        teamMemberUserId: null,
      },
    ]);

    const response = await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
      }) as any,
    );
    const body = await response.json();

    expect(mockGetDashboardItems).toHaveBeenCalledWith(VALID_DASHBOARD_ID);
    expect(
      body.items.map((i: { id: string; onDashboard: boolean }) => [
        i.id,
        i.onDashboard,
      ]),
    ).toEqual([
      ["existing-counter-1", true],
      ["new-counter", false],
      ["existing-counter-2", true],
    ]);
  });

  it("does not filter out dashboard counters in the query", async () => {
    mockGetDashboardItems.mockResolvedValue([
      { counterId: "existing-counter-1" },
    ]);

    await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
      }) as any,
    );

    const conditions = mockWhere.mock.calls[
      mockWhere.mock.calls.length - 1
    ][0] as unknown[];
    expect(conditions).toHaveLength(1);
  });

  it("marks all counters as not on dashboard when dashboard has no items", async () => {
    mockGetDashboardItems.mockResolvedValue([]);
    setupDbChain([
      {
        id: "counter-1",
        title: "A",
        teamId: null,
        ownerId: null,
        teamMemberUserId: null,
      },
    ]);

    const response = await GET(
      makeEvent(VALID_DASHBOARD_ID, {
        locals: makeLocals("user-1"),
      }) as any,
    );
    const body = await response.json();

    expect(body.items[0].onDashboard).toBe(false);
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

  describe("scope parameter", () => {
    const searchUrl = (query: string) =>
      new URL(
        `http://localhost/api/dashboards/${VALID_DASHBOARD_ID}/search-counters?${query}`,
      );

    const mineCondition = {
      or: [
        [{ eq: ["counters.ownerId", "user-1"] }, { isNull: "counters.teamId" }],
        { isNotNull: "teamMembers.userId" },
      ],
    };

    const othersCondition = [
      { isNull: "teamMembers.userId" },
      {
        or: [
          { isNull: "counters.ownerId" },
          { ne: ["counters.ownerId", "user-1"] },
          { isNotNull: "counters.teamId" },
        ],
      },
    ];

    // First where() call is the membership subquery; the last is the main query
    const whereConditions = () =>
      mockWhere.mock.calls[mockWhere.mock.calls.length - 1][0] as unknown[];

    it("returns 400 for an invalid scope", async () => {
      await expect(
        GET(
          makeEvent(VALID_DASHBOARD_ID, {
            locals: makeLocals("user-1"),
            url: searchUrl("scope=everything"),
          }) as any,
        ),
      ).rejects.toMatchObject({ status: 400 });

      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("defaults to scope=all without mine/others filters and count-first ordering", async () => {
      await GET(
        makeEvent(VALID_DASHBOARD_ID, {
          locals: makeLocals("user-1"),
        }) as any,
      );

      expect(whereConditions()).toHaveLength(1);
      expect(mockOrderBy).toHaveBeenCalledWith(
        { desc: "counters.count" },
        { desc: "counters.updatedAt" },
      );
    });

    it("treats scope=all like the default", async () => {
      await GET(
        makeEvent(VALID_DASHBOARD_ID, {
          locals: makeLocals("user-1"),
          url: searchUrl("scope=all"),
        }) as any,
      );

      expect(whereConditions()).toHaveLength(1);
      expect(mockOrderBy).toHaveBeenCalledWith(
        { desc: "counters.count" },
        { desc: "counters.updatedAt" },
      );
    });

    it("scope=mine restricts to own/team counters ordered by updatedAt first", async () => {
      setupDbChain([
        {
          id: "personal",
          title: "Personal",
          description: null,
          count: 1,
          visibilityMode: "private",
          ownerId: "user-1",
          teamId: null,
          teamName: null,
          teamMemberUserId: null,
        },
      ]);

      const response = await GET(
        makeEvent(VALID_DASHBOARD_ID, {
          locals: makeLocals("user-1"),
          url: searchUrl("scope=mine&q=pers"),
        }) as any,
      );
      const body = await response.json();

      const conditions = whereConditions();
      expect(conditions).toContainEqual(mineCondition);
      expect(conditions).not.toContainEqual(othersCondition);
      expect(conditions).toContainEqual({
        ilike: ["counters.title", "%pers%"],
      });
      expect(mockOrderBy).toHaveBeenCalledWith(
        { desc: "counters.updatedAt" },
        { desc: "counters.count" },
      );
      expect(body).toEqual({
        items: [
          {
            id: "personal",
            title: "Personal",
            description: null,
            count: 1,
            visibilityMode: "private",
            ownerId: "user-1",
            teamId: null,
            teamName: null,
            isMine: true,
            onDashboard: false,
          },
        ],
        userId: "user-1",
      });
    });

    it("scope=others excludes mine and keeps count-first ordering", async () => {
      const { ne } = await import("drizzle-orm");

      await GET(
        makeEvent(VALID_DASHBOARD_ID, {
          locals: makeLocals("user-1"),
          url: searchUrl("scope=others"),
        }) as any,
      );

      const conditions = whereConditions();
      expect(ne).toHaveBeenCalledWith("counters.ownerId", "user-1");
      expect(conditions).toContainEqual(othersCondition);
      expect(conditions).not.toContainEqual(mineCondition);
      expect(mockOrderBy).toHaveBeenCalledWith(
        { desc: "counters.count" },
        { desc: "counters.updatedAt" },
      );
    });

    it.each([
      ["mine", "100", 50],
      ["mine", "35", 35],
      ["others", "50", 20],
      ["all", "50", 20],
    ])(
      "scope=%s with limit=%s uses limit %i",
      async (scope, limit, expected) => {
        await GET(
          makeEvent(VALID_DASHBOARD_ID, {
            locals: makeLocals("user-1"),
            url: searchUrl(`scope=${scope}&limit=${limit}`),
          }) as any,
        );

        expect(mockLimit).toHaveBeenCalledWith(expected);
      },
    );
  });
});
