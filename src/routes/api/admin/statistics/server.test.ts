import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHasPermission, mockDbSelect } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockDbSelect: vi.fn(),
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
    entityId: "entity_id",
    entityType: "entity_type",
    metadata: "metadata",
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
 * Sets up the chained mock for the single db.select() query:
 * select → from → where → groupBy → orderBy
 */
function setupDbQuery(result: unknown[] = []) {
  const orderBy = vi.fn().mockResolvedValue(result);
  const groupBy = vi.fn().mockReturnValue({ orderBy });
  const where = vi.fn().mockReturnValue({ groupBy });
  const from = vi.fn().mockReturnValue({ where });
  mockDbSelect.mockReturnValue({ from });
}

const USER_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/statistics", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(GET(makeEvent())).rejects.toMatchObject({ status: 401 });
  });

  it("returns 401 when session has no user id", async () => {
    await expect(
      GET(
        makeEvent(
          {},
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
      GET(makeEvent({}, { locals: makeLocals(USER_ID) })),
    ).rejects.toMatchObject({ status: 403 });

    expect(mockHasPermission).toHaveBeenCalledWith(USER_ID, "user:manage");
  });

  it("returns 400 for invalid timeframe", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(makeEvent({ timeframe: "1y" }, { locals: makeLocals(USER_ID) })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for invalid filter.eventType", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(
        makeEvent(
          { "filter.eventType": "invalid_type" },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns correctly structured data", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQuery([
      { bucket: "2025-05-01T00:00:00Z", eventType: "counter_action", count: 5 },
      {
        bucket: "2025-05-01T00:00:00Z",
        eventType: "counter_created",
        count: 2,
      },
      { bucket: "2025-05-02T00:00:00Z", eventType: "counter_action", count: 3 },
    ]);

    const response = await GET(
      makeEvent({ timeframe: "30d" }, { locals: makeLocals(USER_ID) }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      timeframe: "30d",
      granularity: "daily",
      since: expect.any(String),
      queryDurationMs: expect.any(Number),
      timeSeries: {
        counter_action: [
          { timestamp: "2025-05-01T00:00:00Z", count: 5 },
          { timestamp: "2025-05-02T00:00:00Z", count: 3 },
        ],
        counter_created: [{ timestamp: "2025-05-01T00:00:00Z", count: 2 }],
      },
    });
  });

  it("defaults timeframe to 30d", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQuery([]);

    const response = await GET(makeEvent({}, { locals: makeLocals(USER_ID) }));

    const body = await response.json();
    expect(body.timeframe).toBe("30d");
    expect(body.granularity).toBe("daily");
  });

  it("uses hourly granularity for 24h timeframe", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQuery([]);

    const response = await GET(
      makeEvent({ timeframe: "24h" }, { locals: makeLocals(USER_ID) }),
    );

    const body = await response.json();
    expect(body.timeframe).toBe("24h");
    expect(body.granularity).toBe("hourly");
  });

  it("uses hourly granularity for 7d timeframe", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQuery([]);

    const response = await GET(
      makeEvent({ timeframe: "7d" }, { locals: makeLocals(USER_ID) }),
    );

    const body = await response.json();
    expect(body.timeframe).toBe("7d");
    expect(body.granularity).toBe("hourly");
  });

  it("returns stacked data when no eventType filter", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQuery([
      {
        bucket: "2025-05-01T00:00:00Z",
        eventType: "counter_action",
        count: 10,
      },
      {
        bucket: "2025-05-01T00:00:00Z",
        eventType: "user_registered",
        count: 1,
      },
    ]);

    const response = await GET(makeEvent({}, { locals: makeLocals(USER_ID) }));

    const body = await response.json();
    expect(Object.keys(body.timeSeries)).toEqual([
      "counter_action",
      "user_registered",
    ]);
    expect(body.timeSeries.counter_action).toHaveLength(1);
    expect(body.timeSeries.user_registered).toHaveLength(1);
  });

  it("returns single type when filter.eventType is set", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQuery([
      {
        bucket: "2025-05-01T00:00:00Z",
        eventType: "counter_created",
        count: 4,
      },
    ]);

    const response = await GET(
      makeEvent(
        { "filter.eventType": "counter_created" },
        { locals: makeLocals(USER_ID) },
      ),
    );

    const body = await response.json();
    expect(Object.keys(body.timeSeries)).toEqual(["counter_created"]);
    expect(body.timeSeries.counter_created).toEqual([
      { timestamp: "2025-05-01T00:00:00Z", count: 4 },
    ]);
  });
});
