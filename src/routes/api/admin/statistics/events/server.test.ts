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
  counters: {
    id: "id",
    title: "title",
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
  const url = new URL("http://localhost/api/admin/statistics/events");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return {
    url,
    locals: makeLocals(null),
    ...overrides,
  } as unknown as Parameters<typeof GET>[0];
}

function setupDbQueries(countTotal: number, events: unknown[] = []) {
  // Count query: select → from → where
  const countWhere = vi.fn().mockResolvedValue([{ total: countTotal }]);
  const countFrom = vi.fn().mockReturnValue({ where: countWhere });

  // Events query: select → from → leftJoin → where → orderBy → limit → offset
  const eventsOffset = vi.fn().mockResolvedValue(events);
  const eventsLimit = vi.fn().mockReturnValue({ offset: eventsOffset });
  const eventsOrderBy = vi.fn().mockReturnValue({ limit: eventsLimit });
  const eventsWhere = vi.fn().mockReturnValue({ orderBy: eventsOrderBy });
  const eventsLeftJoin = vi.fn().mockReturnValue({ where: eventsWhere });
  const eventsFrom = vi.fn().mockReturnValue({ leftJoin: eventsLeftJoin });

  // Counter title enrichment query: select → from → where
  const counterWhere = vi.fn().mockResolvedValue([]);
  const counterFrom = vi.fn().mockReturnValue({ where: counterWhere });

  // Invited user enrichment query: select → from → where
  const userWhere = vi.fn().mockResolvedValue([]);
  const userFrom = vi.fn().mockReturnValue({ where: userWhere });

  mockDbSelect
    .mockReturnValueOnce({ from: countFrom })
    .mockReturnValueOnce({ from: eventsFrom })
    .mockReturnValueOnce({ from: counterFrom })
    .mockReturnValueOnce({ from: userFrom });
}

const SAMPLE_EVENT = {
  id: "evt-1",
  eventType: "counter_action",
  userId: USER_ID,
  entityId: "counter-1",
  entityType: "counter",
  metadata: { action: "increment" },
  createdAt: "2025-05-01T12:00:00Z",
  userName: "Test User",
  userUsername: "testuser",
  userImage: "https://example.com/avatar.png",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/admin/statistics/events", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(GET(makeEvent())).rejects.toMatchObject({ status: 401 });
  });

  it("returns 403 when not admin", async () => {
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

  it("returns events without eventType filter", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries(1, [SAMPLE_EVENT]);

    const response = await GET(makeEvent({}, { locals: makeLocals(USER_ID) }));

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      timeframe: "30d",
      page: 1,
      pageSize: 50,
      total: 1,
      totalPages: 1,
      queryDurationMs: expect.any(Number),
      events: [
        {
          id: "evt-1",
          eventType: "counter_action",
          userId: USER_ID,
          entityId: "counter-1",
          entityType: "counter",
          metadata: { action: "increment" },
          createdAt: "2025-05-01T12:00:00Z",
          user: {
            name: "Test User",
            username: "testuser",
            image: "https://example.com/avatar.png",
          },
        },
      ],
    });
  });

  it("returns events filtered by eventType", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries(1, [SAMPLE_EVENT]);

    const response = await GET(
      makeEvent(
        { "filter.eventType": "counter_action" },
        { locals: makeLocals(USER_ID) },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.events).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("paginates correctly", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries(100, [SAMPLE_EVENT]);

    const response = await GET(
      makeEvent({ page: "2" }, { locals: makeLocals(USER_ID) }),
    );

    const body = await response.json();
    expect(body.page).toBe(2);
    expect(body.total).toBe(100);
    expect(body.totalPages).toBe(2);
  });

  it("sets user to null when event has no userId", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries(1, [
      {
        ...SAMPLE_EVENT,
        userId: null,
        userName: null,
        userUsername: null,
        userImage: null,
      },
    ]);

    const response = await GET(makeEvent({}, { locals: makeLocals(USER_ID) }));

    const body = await response.json();
    expect(body.events[0].user).toBeNull();
  });

  it("applies metadata filters", async () => {
    mockHasPermission.mockResolvedValue(true);
    setupDbQueries(1, [SAMPLE_EVENT]);

    const response = await GET(
      makeEvent(
        { "filter.action": "increment" },
        { locals: makeLocals(USER_ID) },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.events).toHaveLength(1);
  });
});
