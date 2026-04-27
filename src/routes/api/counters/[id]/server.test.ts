import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCounter,
  mockIncrementCounter,
  mockUpdateCounter,
  mockDeleteCounter,
  mockCanIncrementCounter,
  mockCanEditCounter,
  mockCanDeleteCounter,
  mockCanViewPrivateCounter,
  mockGetUserRole,
  mockEmitCounterUpdate,
} = vi.hoisted(() => ({
  mockGetCounter: vi.fn(),
  mockIncrementCounter: vi.fn(),
  mockUpdateCounter: vi.fn(),
  mockDeleteCounter: vi.fn(),
  mockCanIncrementCounter: vi.fn(),
  mockCanEditCounter: vi.fn(),
  mockCanDeleteCounter: vi.fn(),
  mockCanViewPrivateCounter: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockEmitCounterUpdate: vi.fn(),
}));

vi.mock("$lib/server/counters", () => ({
  getCounter: mockGetCounter,
  incrementCounter: mockIncrementCounter,
  updateCounter: mockUpdateCounter,
  deleteCounter: mockDeleteCounter,
}));

vi.mock("$lib/server/authorize", () => ({
  canIncrementCounter: mockCanIncrementCounter,
  canEditCounter: mockCanEditCounter,
  canDeleteCounter: mockCanDeleteCounter,
  canViewPrivateCounter: mockCanViewPrivateCounter,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("$lib/server/permissions", () => ({
  getUserRole: mockGetUserRole,
}));

vi.mock("$lib/server/ratelimit", () => ({
  RATE_LIMIT_CONFIG: {
    "/api/counters/[id]": { windowMs: 5000, maxRequests: 1 },
  },
  RATE_LIMIT_CONFIG_UNAUTHENTICATED: {
    "/api/counters/[id]": { windowMs: 30000, maxRequests: 1 },
  },
}));

vi.mock("$lib/server/request", () => ({
  parseAndValidateBody: vi.fn(
    async (_req: Request, _schema: unknown, _label: string) => ({
      success: true,
      data: JSON.parse(await _req.text()),
    }),
  ),
}));

vi.mock("$lib/utils/socket", () => ({
  emitCounterUpdate: mockEmitCounterUpdate,
}));

vi.mock("$lib/utils/validation", () => ({
  counterIdSchema: {
    safeParse: (val: string) => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(val)
        ? { success: true, data: val }
        : { success: false };
    },
  },
  updateCounterSchema: {},
}));

import { DELETE, PATCH, POST } from "./+server";

const VALID_ID = "11111111-1111-1111-1111-111111111111";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    params: { id },
    locals: makeLocals(null),
    url: new URL(`http://localhost/api/counters/${id}`),
    request: new Request(`http://localhost/api/counters/${id}`, {
      method: "POST",
    }),
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUserRole.mockResolvedValue("user");
});

describe("POST /api/counters/[id] (increment)", () => {
  it("returns 400 for invalid counter ID", async () => {
    await expect(POST(makeEvent("not-a-uuid"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 404 when counter does not exist", async () => {
    mockGetCounter.mockResolvedValue(null);
    await expect(POST(makeEvent(VALID_ID))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("increments and returns updated counter", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public",
      shareToken: null,
    });
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 42,
      updatedAt: "2026-01-01T00:00:00Z",
    });
    mockGetUserRole.mockResolvedValue("user");

    const response = await POST(
      makeEvent(VALID_ID, { locals: makeLocals("user-1") }),
    );
    const body = await response.json();

    expect(body.count).toBe(42);
    expect(body.cooldownSeconds).toBe(5);
    expect(mockEmitCounterUpdate).toHaveBeenCalledWith(
      VALID_ID,
      42,
      "2026-01-01T00:00:00Z",
    );
  });

  it("returns cooldownSeconds=0 for admin users", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public",
      shareToken: null,
    });
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 10,
      updatedAt: "2026-01-01T00:00:00Z",
    });
    mockGetUserRole.mockResolvedValue("admin");

    const response = await POST(
      makeEvent(VALID_ID, { locals: makeLocals("admin-1") }),
    );
    const body = await response.json();

    expect(body.cooldownSeconds).toBe(0);
  });

  it("allows anonymous increment for public counters", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public",
      shareToken: null,
    });
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 9,
      updatedAt: "2026-01-01T00:00:00Z",
    });

    const response = await POST(makeEvent(VALID_ID));
    const body = await response.json();

    expect(body.count).toBe(9);
    expect(body.cooldownSeconds).toBe(30);
    expect(mockCanIncrementCounter).not.toHaveBeenCalled();
  });

  it("denies anonymous increment for public read-only counters", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public_readonly",
      shareToken: null,
    });

    await expect(POST(makeEvent(VALID_ID))).rejects.toMatchObject({
      status: 403,
    });
    expect(mockCanIncrementCounter).not.toHaveBeenCalled();
  });

  it("allows public read-only increment for members with increment rights", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public_readonly",
      shareToken: null,
    });
    mockCanIncrementCounter.mockResolvedValue(true);
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 12,
      updatedAt: "2026-01-01T00:00:00Z",
    });

    const response = await POST(
      makeEvent(VALID_ID, { locals: makeLocals("member-1") }),
    );
    const body = await response.json();

    expect(body.count).toBe(12);
    expect(mockCanIncrementCounter).toHaveBeenCalledWith("member-1", VALID_ID);
  });

  it("denies logged-in users without increment rights on public read-only counters", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public_readonly",
      shareToken: null,
    });
    mockCanIncrementCounter.mockResolvedValue(false);

    await expect(
      POST(makeEvent(VALID_ID, { locals: makeLocals("viewer-1") })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns 404 for private counter without token and not logged in", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "abc123",
    });

    await expect(POST(makeEvent(VALID_ID))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns 404 for private counter with invalid token", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "abc123",
    });

    await expect(
      POST(
        makeEvent(VALID_ID, {
          url: new URL(`http://localhost/api/counters/${VALID_ID}?token=wrong`),
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("allows private counter increment with valid share token", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "valid-token-123",
    });
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 5,
      updatedAt: "2026-01-01T00:00:00Z",
    });

    const response = await POST(
      makeEvent(VALID_ID, {
        url: new URL(
          `http://localhost/api/counters/${VALID_ID}?token=valid-token-123`,
        ),
      }),
    );
    const body = await response.json();

    expect(body.count).toBe(5);
  });

  it("allows private counter increment for authorized member", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "abc123",
    });
    mockCanViewPrivateCounter.mockResolvedValue(true);
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 7,
      updatedAt: "2026-01-01T00:00:00Z",
    });
    mockGetUserRole.mockResolvedValue("user");

    const response = await POST(
      makeEvent(VALID_ID, { locals: makeLocals("user-1") }),
    );
    const body = await response.json();

    expect(body.count).toBe(7);
  });

  it("returns 404 for private counter when logged-in user lacks access", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "abc123",
    });
    mockCanViewPrivateCounter.mockResolvedValue(false);

    await expect(
      POST(makeEvent(VALID_ID, { locals: makeLocals("user-1") })),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("PATCH /api/counters/[id] (update)", () => {
  it("returns 400 for invalid counter ID", async () => {
    await expect(
      PATCH(
        makeEvent("bad-id", {
          request: new Request("http://localhost", { method: "PATCH" }),
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(
      PATCH(
        makeEvent(VALID_ID, {
          request: new Request("http://localhost", { method: "PATCH" }),
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns 403 when user lacks edit permission", async () => {
    mockCanEditCounter.mockResolvedValue(false);

    await expect(
      PATCH(
        makeEvent(VALID_ID, {
          locals: makeLocals("user-1"),
          request: new Request("http://localhost", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "New" }),
          }),
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("updates counter successfully", async () => {
    mockCanEditCounter.mockResolvedValue(true);
    mockUpdateCounter.mockResolvedValue({
      id: VALID_ID,
      title: "Updated",
      visibilityMode: "public_readonly",
    });

    const response = await PATCH(
      makeEvent(VALID_ID, {
        locals: makeLocals("user-1"),
        request: new Request("http://localhost", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Updated",
            description: "",
            visibility: "public",
          }),
        }),
      }),
    );
    const body = await response.json();

    expect(body.title).toBe("Updated");
    expect(mockUpdateCounter).toHaveBeenCalledWith(VALID_ID, {
      title: "Updated",
      description: "",
      visibilityMode: "public",
    });
  });

  it("maps visibility to visibilityMode when updating the counter", async () => {
    mockCanEditCounter.mockResolvedValue(true);
    mockUpdateCounter.mockResolvedValue({
      id: VALID_ID,
      title: "Read only counter",
      visibilityMode: "public_readonly",
    });

    await PATCH(
      makeEvent(VALID_ID, {
        locals: makeLocals("user-1"),
        request: new Request("http://localhost", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Read only counter",
            description: "Locked for viewers",
            visibility: "public_readonly",
          }),
        }),
      }),
    );

    expect(mockUpdateCounter).toHaveBeenCalledWith(VALID_ID, {
      title: "Read only counter",
      description: "Locked for viewers",
      visibilityMode: "public_readonly",
    });
  });
});

describe("DELETE /api/counters/[id]", () => {
  it("returns 400 for invalid counter ID", async () => {
    await expect(DELETE(makeEvent("bad-id"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 401 when not authenticated", async () => {
    await expect(DELETE(makeEvent(VALID_ID))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns 403 when user lacks delete permission", async () => {
    mockCanDeleteCounter.mockResolvedValue(false);

    await expect(
      DELETE(makeEvent(VALID_ID, { locals: makeLocals("user-1") })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("deletes counter successfully", async () => {
    mockCanDeleteCounter.mockResolvedValue(true);
    mockDeleteCounter.mockResolvedValue({ id: VALID_ID });

    const response = await DELETE(
      makeEvent(VALID_ID, { locals: makeLocals("user-1") }),
    );
    const body = await response.json();

    expect(body.success).toBe(true);
  });

  it("returns 404 when counter does not exist", async () => {
    mockCanDeleteCounter.mockResolvedValue(true);
    mockDeleteCounter.mockResolvedValue(null);

    await expect(
      DELETE(makeEvent(VALID_ID, { locals: makeLocals("user-1") })),
    ).rejects.toMatchObject({ status: 404 });
  });
});
