import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCounter,
  mockIncrementCounter,
  mockUpdateCounter,
  mockDeleteCounter,
  mockCanIncrementCounter,
  mockCanEditCounter,
  mockCanDeleteCounter,
  mockCanIncrementPrivateCounter,
  mockGetUserRole,
  mockEmitCounterUpdate,
  mockCheckCounterCooldown,
  mockCheckPrivateCounterCooldown,
  mockRecordCounterCooldown,
} = vi.hoisted(() => ({
  mockGetCounter: vi.fn(),
  mockIncrementCounter: vi.fn(),
  mockUpdateCounter: vi.fn(),
  mockDeleteCounter: vi.fn(),
  mockCanIncrementCounter: vi.fn(),
  mockCanEditCounter: vi.fn(),
  mockCanDeleteCounter: vi.fn(),
  mockCanIncrementPrivateCounter: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockEmitCounterUpdate: vi.fn(),
  mockCheckCounterCooldown: vi.fn(),
  mockCheckPrivateCounterCooldown: vi.fn(),
  mockRecordCounterCooldown: vi.fn(),
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
  canIncrementPrivateCounter: mockCanIncrementPrivateCounter,
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
  checkCounterCooldown: mockCheckCounterCooldown,
  checkPrivateCounterCooldown: mockCheckPrivateCounterCooldown,
  recordCounterCooldown: mockRecordCounterCooldown,
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
  incrementCounterSchema: {},
  updateCounterSchema: {},
}));

import { CounterOverflowError } from "$lib/server/counter-limits";
import { DELETE, PATCH, POST } from "./+server";

const VALID_ID = "11111111-1111-1111-1111-111111111111";

function makeLocals(
  userId: string | null,
  username: string | null = "testuser",
) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId, username } } : { user: null },
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
  mockCheckCounterCooldown.mockResolvedValue({
    blocked: false,
    cooldownSeconds: 5,
  });
  mockCheckPrivateCounterCooldown.mockResolvedValue({
    blocked: false,
    cooldownSeconds: 0,
  });
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
    expect(body.username).toBe("testuser");
    expect(mockCheckCounterCooldown).toHaveBeenCalledWith(VALID_ID, "user-1", {
      cooldownEnabled: false,
      cooldownSeconds: 0,
      ownerId: undefined,
    });
    expect(mockCheckPrivateCounterCooldown).not.toHaveBeenCalled();
    expect(mockEmitCounterUpdate).toHaveBeenCalledWith(
      VALID_ID,
      42,
      "2026-01-01T00:00:00Z",
      expect.any(String),
      1,
      5,
      { visibilityMode: "public", ownerId: undefined, teamId: undefined },
    );
    expect(mockRecordCounterCooldown).toHaveBeenCalledWith(VALID_ID);
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
    mockCheckCounterCooldown.mockResolvedValue({
      blocked: false,
      cooldownSeconds: 0,
    });

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
    mockCheckCounterCooldown.mockResolvedValue({
      blocked: false,
      cooldownSeconds: 30,
    });

    const response = await POST(makeEvent(VALID_ID));
    const body = await response.json();

    expect(body.count).toBe(9);
    expect(body.cooldownSeconds).toBe(30);
    expect(mockCanIncrementCounter).not.toHaveBeenCalled();
  });

  it("returns 429 when counter-wide cooldown is active", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public",
      shareToken: null,
      cooldownEnabled: true,
      cooldownSeconds: 10,
      ownerId: "owner-1",
    });
    mockCheckCounterCooldown.mockResolvedValue({
      blocked: true,
      retryAfterSeconds: 7,
    });

    const response = await POST(makeEvent(VALID_ID));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7");
    const body = await response.json();
    expect(body.error).toBe("Counter is in cooldown");
    expect(body.retryAfterSeconds).toBe(7);
    expect(mockIncrementCounter).not.toHaveBeenCalled();
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
    expect(mockCanIncrementPrivateCounter).not.toHaveBeenCalled();
  });

  it("allows a signed-in viewer to increment with a valid share token", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "valid-token-123",
    });
    mockCanIncrementPrivateCounter.mockResolvedValue("forbidden");
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 6,
      updatedAt: "2026-01-01T00:00:00Z",
    });

    const response = await POST(
      makeEvent(VALID_ID, {
        locals: makeLocals("viewer-1"),
        url: new URL(
          `http://localhost/api/counters/${VALID_ID}?token=valid-token-123`,
        ),
      }),
    );
    const body = await response.json();

    expect(body.count).toBe(6);
    expect(mockCanIncrementPrivateCounter).not.toHaveBeenCalled();
  });

  it("uses private cooldown logic for private counters", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "valid-token-123",
      cooldownEnabled: false,
      cooldownSeconds: 0,
    });
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 6,
      updatedAt: "2026-01-01T00:00:00Z",
    });

    await POST(
      makeEvent(VALID_ID, {
        url: new URL(
          `http://localhost/api/counters/${VALID_ID}?token=valid-token-123`,
        ),
      }),
    );

    expect(mockCheckPrivateCounterCooldown).toHaveBeenCalled();
    expect(mockCheckCounterCooldown).not.toHaveBeenCalled();
  });

  it("returns 429 when private cooldown/debounce is active", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "valid-token-123",
      cooldownEnabled: false,
      cooldownSeconds: 0,
    });
    mockCheckPrivateCounterCooldown.mockResolvedValue({
      blocked: true,
      retryAfterSeconds: 1,
    });

    const response = await POST(
      makeEvent(VALID_ID, {
        url: new URL(
          `http://localhost/api/counters/${VALID_ID}?token=valid-token-123`,
        ),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it.each([
    ["incrementer member", "incrementer-1"],
    ["follower without a role", "follower-1"],
  ])("allows private counter increment for %s", async (_label, userId) => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "abc123",
    });
    mockCanIncrementPrivateCounter.mockResolvedValue("allowed");
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 7,
      updatedAt: "2026-01-01T00:00:00Z",
    });

    const response = await POST(
      makeEvent(VALID_ID, { locals: makeLocals(userId) }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(7);
    expect(mockCanIncrementPrivateCounter).toHaveBeenCalledWith(
      userId,
      VALID_ID,
    );
  });

  it.each([
    ["direct viewer member", "viewer-1"],
    ["team viewer", "team-viewer-1"],
  ])("returns 403 on private counter for %s", async (_label, userId) => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "abc123",
    });
    mockCanIncrementPrivateCounter.mockResolvedValue("forbidden");

    await expect(
      POST(makeEvent(VALID_ID, { locals: makeLocals(userId) })),
    ).rejects.toMatchObject({
      status: 403,
      body: {
        message: "You don't have permission to increment this counter",
      },
    });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it("returns 404 for private counter when logged-in user lacks access", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "abc123",
    });
    mockCanIncrementPrivateCounter.mockResolvedValue("not_found");

    await expect(
      POST(makeEvent(VALID_ID, { locals: makeLocals("user-1") })),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });
});

describe("POST /api/counters/[id] (amount limits)", () => {
  function jsonPost(amount: number, locals?: unknown) {
    return makeEvent(VALID_ID, {
      ...(locals ? { locals } : {}),
      request: new Request(`http://localhost/api/counters/${VALID_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      }),
    });
  }

  beforeEach(() => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public",
      counterMode: "both",
      shareToken: null,
    });
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 50,
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("rejects anonymous amounts above 1", async () => {
    await expect(POST(jsonPost(5))).rejects.toMatchObject({ status: 400 });
    await expect(POST(jsonPost(-2))).rejects.toMatchObject({ status: 400 });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it("allows anonymous +1 and -1", async () => {
    expect((await POST(jsonPost(1))).status).toBe(200);
    expect((await POST(jsonPost(-1))).status).toBe(200);
  });

  it("allows signed-in users larger amounts", async () => {
    const response = await POST(jsonPost(500, makeLocals("user-1")));
    expect(response.status).toBe(200);
    expect(mockIncrementCounter).toHaveBeenCalledWith(VALID_ID, 500, "user-1");
  });

  it("maps counter overflow to 409", async () => {
    mockIncrementCounter.mockRejectedValue(new CounterOverflowError());
    await expect(
      POST(jsonPost(1, makeLocals("user-1"))),
    ).rejects.toMatchObject({ status: 409 });
    expect(mockEmitCounterUpdate).not.toHaveBeenCalled();
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

describe("POST /api/counters/[id] (share token handling)", () => {
  function withToken(token: string, locals?: unknown) {
    return makeEvent(VALID_ID, {
      ...(locals ? { locals } : {}),
      url: new URL(
        `http://localhost/api/counters/${VALID_ID}?token=${encodeURIComponent(token)}`,
      ),
    });
  }

  beforeEach(() => {
    mockIncrementCounter.mockResolvedValue({
      id: VALID_ID,
      count: 1,
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });

  it.each([
    ["shorter", "valid"],
    ["longer", "valid-token-123-extra"],
    ["empty", ""],
  ])("rejects a %s token on a private counter", async (_label, token) => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "valid-token-123",
    });

    await expect(POST(withToken(token))).rejects.toMatchObject({
      status: 404,
    });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it.each([
    "null",
    "undefined",
    "",
  ])("rejects token %j when the stored token is null", async (token) => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: null,
    });

    await expect(POST(withToken(token))).rejects.toMatchObject({
      status: 404,
    });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it("falls back to member permissions when the token is wrong", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "private",
      shareToken: "valid-token-123",
    });
    mockCanIncrementPrivateCounter.mockResolvedValue("forbidden");

    await expect(
      POST(withToken("nope", makeLocals("viewer-1"))),
    ).rejects.toMatchObject({ status: 403 });
    expect(mockCanIncrementPrivateCounter).toHaveBeenCalledWith(
      "viewer-1",
      VALID_ID,
    );
  });

  it("ignores a matching token on a public counter (standard cooldown)", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public",
      counterMode: "both",
      shareToken: "stale-token",
    });

    const response = await POST(withToken("stale-token"));

    expect(response.status).toBe(200);
    expect(mockCheckCounterCooldown).toHaveBeenCalled();
    expect(mockCheckPrivateCounterCooldown).not.toHaveBeenCalled();
  });

  it("ignores a matching token on a public_readonly counter", async () => {
    mockGetCounter.mockResolvedValue({
      id: VALID_ID,
      visibilityMode: "public_readonly",
      shareToken: "stale-token",
    });

    await expect(POST(withToken("stale-token"))).rejects.toMatchObject({
      status: 403,
    });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/counters/[id] (share token)", () => {
  it("never returns the share token to editors", async () => {
    mockCanEditCounter.mockResolvedValue(true);
    mockUpdateCounter.mockResolvedValue({
      id: VALID_ID,
      title: "Updated",
      visibilityMode: "private",
      shareToken: "secret-token",
    });

    const response = await PATCH(
      makeEvent(VALID_ID, {
        locals: makeLocals("editor-1"),
        request: new Request(`http://localhost/api/counters/${VALID_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: VALID_ID, title: "Updated" });
    expect(body).not.toHaveProperty("shareToken");
  });
});
