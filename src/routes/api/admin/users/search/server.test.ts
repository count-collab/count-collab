import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHasPermission, mockListUsers } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockListUsers: vi.fn(),
}));

vi.mock("$lib/server/permissions", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("$lib/server/users", () => ({
  listUsers: mockListUsers,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { GET } from "./+server";

const USER_ID = "22222222-2222-2222-2222-222222222222";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(
  query: string | null = null,
  overrides: Record<string, unknown> = {},
) {
  const url = new URL("http://localhost/api/admin/users/search");
  if (query !== null) {
    url.searchParams.set("q", query);
  }
  return {
    params: {},
    locals: makeLocals(null),
    url,
    request: new Request(url.toString()),
    ...overrides,
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/users/search", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(GET(makeEvent("test"))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 403 when user lacks user:manage permission", async () => {
    mockHasPermission.mockResolvedValue(false);

    await expect(
      GET(makeEvent("test", { locals: makeLocals(USER_ID) })),
    ).rejects.toMatchObject({ status: 403 });

    expect(mockHasPermission).toHaveBeenCalledWith(USER_ID, "user:manage");
  });

  it("returns 400 when query is missing", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(makeEvent(null, { locals: makeLocals(USER_ID) })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 when query is empty", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(makeEvent("", { locals: makeLocals(USER_ID) })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 400 when query is whitespace only", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      GET(makeEvent("   ", { locals: makeLocals(USER_ID) })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("successfully returns search results", async () => {
    const mockUsers = [
      {
        id: "user-1",
        name: "Alice",
        username: "alice",
        email: "alice@example.com",
        image: "https://example.com/alice.png",
        role: "user",
      },
      {
        id: "user-2",
        name: "Bob",
        username: "bob",
        email: "bob@example.com",
        image: null,
        role: "admin",
      },
    ];

    mockHasPermission.mockResolvedValue(true);
    mockListUsers.mockResolvedValue({ items: mockUsers, total: 2 });

    const response = await GET(
      makeEvent("ali", { locals: makeLocals(USER_ID) }),
    );
    const body = await response.json();

    expect(body.users).toHaveLength(2);
    expect(body.users[0]).toEqual({
      id: "user-1",
      name: "Alice",
      username: "alice",
      email: "alice@example.com",
      image: "https://example.com/alice.png",
    });
    // Verify extra fields like 'role' are not leaked
    expect(body.users[0]).not.toHaveProperty("role");
    expect(mockListUsers).toHaveBeenCalledWith(20, "ali");
  });

  it("returns empty array when no users match", async () => {
    mockHasPermission.mockResolvedValue(true);
    mockListUsers.mockResolvedValue({ items: [], total: 0 });

    const response = await GET(
      makeEvent("nonexistent", { locals: makeLocals(USER_ID) }),
    );
    const body = await response.json();

    expect(body.users).toEqual([]);
  });
});
