import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHasPermission, mockDbSelect } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbFrom: vi.fn(),
  mockDbWhere: vi.fn(),
  mockDbGroupBy: vi.fn(),
  mockDbOrderBy: vi.fn(),
  mockDbLeftJoin: vi.fn(),
  mockDbLimit: vi.fn(),
}));

vi.mock("$lib/server/permissions", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock("$lib/db/schema", () => ({
  platformEvents: {
    eventType: "event_type",
    createdAt: "created_at",
    userId: "user_id",
  },
  users: {
    id: "id",
    name: "name",
    username: "username",
    image: "image",
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./+server";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(
  searchParams: Record<string, string> = {},
  overrides: Record<string, unknown> = {},
) {
  const url = new URL("http://localhost/api/admin/statistics");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return {
    url,
    locals: makeLocals(null),
    ...overrides,
  } as unknown as Parameters<typeof GET>[0];
}

/**
 * Sets up the chained mock calls for both db.select() queries:
 * 1. timeSeries: select → from → where → groupBy → orderBy
 * 2. topUsers: select → from → leftJoin → where → groupBy → orderBy → limit
 */
function setupDbQueries(
  timeSeriesResult: unknown[] = [],
  topUsersResult: unknown[] = [],
) {
  // First select call: timeSeries
  const tsOrderBy = vi.fn().mockResolvedValue(timeSeriesResult);
  const tsGroupBy = vi.fn().mockReturnValue({ orderBy: tsOrderBy });
  const tsWhere = vi.fn().mockReturnValue({ groupBy: tsGroupBy });
  const tsFrom = vi.fn().mockReturnValue({ where: tsWhere });

  // Second select call: topUsers
  const tuLimit = vi.fn().mockResolvedValue(topUsersResult);
  const tuOrderBy = vi.fn().mockReturnValue({ limit: tuLimit });
  const tuGroupBy = vi.fn().mockReturnValue({ orderBy: tuOrderBy });
  const tuWhere = vi.fn().mockReturnValue({ groupBy: tuGroupBy });
  const tuLeftJoin = vi.fn().mockReturnValue({ where: tuWhere });
  const tuFrom = vi.fn().mockReturnValue({ leftJoin: tuLeftJoin });

  mockDbSelect
    .mockReturnValueOnce({ from: tsFrom })
    .mockReturnValueOnce({ from: tuFrom });
}

const USER_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/statistics", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(
      GET(makeEvent({ metric: "counter_created" })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns 401 when session has no user id", async () => {
    await expect(
      GET(
        makeEvent(
          { metric: "counter_created" },
          {
            locals: {
              auth: vi.fn(async () => ({ user: {} })),
            },
          },
        ),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns 403 when user is not admin", async () => {
    mockHasPermission.mockResolvedValue(false);

    await expect(
      GET(
        makeEvent(
          { metric: "counter_created" },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(mockHasPermission).toHaveBeenCalledWith(USER_ID, "user:manage");
  });

  it("returns 400 when metric is missing", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(makeEvent({}, { locals: makeLocals(USER_ID) })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 when metric is invalid", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(
        makeEvent(
          { metric: "invalid_metric" },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for invalid timeframe", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(
        makeEvent(
          { metric: "counter_created", timeframe: "1y" },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns correctly structured data for a valid request", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries(
      [
        { bucket: "2025-05-01T00:00:00Z", count: 5 },
        { bucket: "2025-05-02T00:00:00Z", count: 3 },
      ],
      [
        {
          userId: USER_ID,
          count: 8,
          userName: "Test User",
          userUsername: "testuser",
          userImage: "https://example.com/avatar.png",
        },
      ],
    );

    const response = await GET(
      makeEvent(
        { metric: "counter_created", timeframe: "30d" },
        { locals: makeLocals(USER_ID) },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.metric).toBe("counter_created");
    expect(body.timeframe).toBe("30d");
    expect(body.granularity).toBe("daily");
    expect(body.since).toBeDefined();
    expect(body.timeSeries).toEqual([
      { timestamp: "2025-05-01T00:00:00Z", count: 5 },
      { timestamp: "2025-05-02T00:00:00Z", count: 3 },
    ]);
    expect(body.topUsers).toEqual([
      {
        userId: USER_ID,
        name: "Test User",
        username: "testuser",
        image: "https://example.com/avatar.png",
        count: 8,
      },
    ]);
  });

  it("defaults timeframe to 30d", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries([], []);

    const response = await GET(
      makeEvent({ metric: "counter_created" }, { locals: makeLocals(USER_ID) }),
    );

    const body = await response.json();
    expect(body.timeframe).toBe("30d");
    expect(body.granularity).toBe("daily");
  });

  it("uses hourly granularity for 24h timeframe", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries([], []);

    const response = await GET(
      makeEvent(
        { metric: "counter_created", timeframe: "24h" },
        { locals: makeLocals(USER_ID) },
      ),
    );

    const body = await response.json();
    expect(body.timeframe).toBe("24h");
    expect(body.granularity).toBe("hourly");
  });

  it("uses hourly granularity for 7d timeframe", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries([], []);

    const response = await GET(
      makeEvent(
        { metric: "counter_created", timeframe: "7d" },
        { locals: makeLocals(USER_ID) },
      ),
    );

    const body = await response.json();
    expect(body.timeframe).toBe("7d");
    expect(body.granularity).toBe("hourly");
  });

  it("filters out null userId entries from topUsers", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries(
      [],
      [
        {
          userId: null,
          count: 10,
          userName: null,
          userUsername: null,
          userImage: null,
        },
        {
          userId: USER_ID,
          count: 5,
          userName: "Test",
          userUsername: "test",
          userImage: null,
        },
      ],
    );

    const response = await GET(
      makeEvent(
        { metric: "counter_created", timeframe: "30d" },
        { locals: makeLocals(USER_ID) },
      ),
    );

    const body = await response.json();
    expect(body.topUsers).toHaveLength(1);
    expect(body.topUsers[0].userId).toBe(USER_ID);
  });
});
