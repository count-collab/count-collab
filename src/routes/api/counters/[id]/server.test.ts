import { describe, expect, it, vi } from "vitest";

const {
  mockIncrementCounter,
  mockUpdateCounter,
  mockDeleteCounter,
  mockCanEditCounter,
  mockCanDeleteCounter,
  mockGetUserRole,
  mockEmitCounterUpdate,
} = vi.hoisted(() => ({
  mockIncrementCounter: vi.fn(),
  mockUpdateCounter: vi.fn(),
  mockDeleteCounter: vi.fn(),
  mockCanEditCounter: vi.fn(),
  mockCanDeleteCounter: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockEmitCounterUpdate: vi.fn(),
}));

vi.mock("$lib/server/counters", () => ({
  incrementCounter: mockIncrementCounter,
  updateCounter: mockUpdateCounter,
  deleteCounter: mockDeleteCounter,
}));

vi.mock("$lib/server/authorize", () => ({
  canEditCounter: mockCanEditCounter,
  canDeleteCounter: mockCanDeleteCounter,
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
    ...overrides,
  } as any;
}

describe("POST /api/counters/[id] (increment)", () => {
  it("returns 400 for invalid counter ID", async () => {
    await expect(POST(makeEvent("not-a-uuid"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 404 when counter does not exist", async () => {
    mockIncrementCounter.mockResolvedValue(null);
    await expect(POST(makeEvent(VALID_ID))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("increments and returns updated counter", async () => {
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
      isPublic: true,
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
