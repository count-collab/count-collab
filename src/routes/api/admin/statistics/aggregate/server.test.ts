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
    id: "id",
    eventType: "event_type",
    createdAt: "created_at",
    userId: "user_id",
    entityId: "entity_id",
    entityType: "entity_type",
    metadata: "metadata",
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

const USER_ID = "11111111-1111-1111-1111-111111111111";

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
  const url = new URL("http://localhost/api/admin/statistics/aggregate");
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
 * Sets up mocks for the two parallel queries: count + values.
 * Standard fields (no join): select → from → where (count) / select → from → where → groupBy → orderBy → limit → offset (values)
 * userId field: values chain adds leftJoin before where, and groupBy includes user columns
 */
function setupStandardQueries(total: number, rows: unknown[] = []) {
  const countWhere = vi.fn().mockResolvedValue([{ total }]);
  const countFrom = vi.fn().mockReturnValue({ where: countWhere });

  const valuesOffset = vi.fn().mockResolvedValue(rows);
  const valuesLimit = vi.fn().mockReturnValue({ offset: valuesOffset });
  const valuesOrderBy = vi.fn().mockReturnValue({ limit: valuesLimit });
  const valuesGroupBy = vi.fn().mockReturnValue({ orderBy: valuesOrderBy });
  const valuesWhere = vi.fn().mockReturnValue({ groupBy: valuesGroupBy });
  const valuesFrom = vi.fn().mockReturnValue({ where: valuesWhere });

  mockDbSelect
    .mockReturnValueOnce({ from: countFrom })
    .mockReturnValueOnce({ from: valuesFrom });
}

function setupUserIdQueries(total: number, rows: unknown[] = []) {
  const countWhere = vi.fn().mockResolvedValue([{ total }]);
  const countFrom = vi.fn().mockReturnValue({ where: countWhere });

  const valuesOffset = vi.fn().mockResolvedValue(rows);
  const valuesLimit = vi.fn().mockReturnValue({ offset: valuesOffset });
  const valuesOrderBy = vi.fn().mockReturnValue({ limit: valuesLimit });
  const valuesGroupBy = vi.fn().mockReturnValue({ orderBy: valuesOrderBy });
  const valuesWhere = vi.fn().mockReturnValue({ groupBy: valuesGroupBy });
  const valuesLeftJoin = vi.fn().mockReturnValue({ where: valuesWhere });
  const valuesFrom = vi.fn().mockReturnValue({ leftJoin: valuesLeftJoin });

  mockDbSelect
    .mockReturnValueOnce({ from: countFrom })
    .mockReturnValueOnce({ from: valuesFrom });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/statistics/aggregate", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(GET(makeEvent({ field: "eventType" }))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 403 when not admin", async () => {
    mockHasPermission.mockResolvedValue(false);

    await expect(
      GET(makeEvent({ field: "eventType" }, { locals: makeLocals(USER_ID) })),
    ).rejects.toMatchObject({ status: 403 });

    expect(mockHasPermission).toHaveBeenCalledWith(USER_ID, "user:manage");
  });

  it("returns 400 when field is missing", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(makeEvent({}, { locals: makeLocals(USER_ID) })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for invalid field name", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(
        makeEvent(
          { field: "event-type; DROP TABLE" },
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
          { field: "eventType", timeframe: "1y" },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 for invalid filter.eventType", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(
        makeEvent(
          { field: "eventType", "filter.eventType": "invalid_type" },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns aggregation for standard field (eventType)", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupStandardQueries(3, [
      { value: "counter_action", count: 50 },
      { value: "counter_created", count: 20 },
      { value: "user_registered", count: 5 },
    ]);

    const response = await GET(
      makeEvent({ field: "eventType" }, { locals: makeLocals(USER_ID) }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      field: "eventType",
      timeframe: "30d",
      queryDurationMs: expect.any(Number),
      total: 3,
      values: [
        {
          value: "counter_action",
          count: 50,
          label: "counter_action",
          extra: null,
        },
        {
          value: "counter_created",
          count: 20,
          label: "counter_created",
          extra: null,
        },
        {
          value: "user_registered",
          count: 5,
          label: "user_registered",
          extra: null,
        },
      ],
    });
  });

  it("returns aggregation for userId with user join", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupUserIdQueries(1, [
      {
        value: USER_ID,
        count: 42,
        name: "Test User",
        username: "testuser",
        image: "https://example.com/avatar.png",
      },
    ]);

    const response = await GET(
      makeEvent({ field: "userId" }, { locals: makeLocals(USER_ID) }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.field).toBe("userId");
    expect(body.total).toBe(1);
    expect(body.values).toEqual([
      {
        value: USER_ID,
        count: 42,
        label: "Test User",
        extra: {
          username: "testuser",
          image: "https://example.com/avatar.png",
        },
      },
    ]);
  });

  it("returns aggregation for metadata field", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupStandardQueries(2, [
      { value: "increment", count: 30 },
      { value: "decrement", count: 10 },
    ]);

    const response = await GET(
      makeEvent({ field: "action" }, { locals: makeLocals(USER_ID) }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.field).toBe("action");
    expect(body.total).toBe(2);
    expect(body.values).toEqual([
      { value: "increment", count: 30, label: "increment", extra: null },
      { value: "decrement", count: 10, label: "decrement", extra: null },
    ]);
  });

  it("respects limit and offset", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupStandardQueries(10, [{ value: "counter_action", count: 50 }]);

    const response = await GET(
      makeEvent(
        { field: "eventType", limit: "1", offset: "5" },
        { locals: makeLocals(USER_ID) },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(10);
    expect(body.values).toHaveLength(1);
  });
});
