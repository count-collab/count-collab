import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTransferCounterOwnership, mockHasPermission, mockDbSelect } =
  vi.hoisted(() => ({
    mockTransferCounterOwnership: vi.fn(),
    mockHasPermission: vi.fn(),
    mockDbSelect: vi.fn(),
  }));

vi.mock("$lib/server/counters", () => ({
  transferCounterOwnership: mockTransferCounterOwnership,
}));

vi.mock("$lib/server/permissions", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("$lib/db", () => {
  const selectChain = {
    from: vi.fn(() => ({
      where: mockDbSelect,
    })),
  };
  return {
    db: {
      select: vi.fn(() => selectChain),
    },
  };
});

vi.mock("$lib/db/schema", () => ({
  users: { id: "id" },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("$lib/server/request", () => ({
  parseAndValidateBody: vi.fn(
    async (_req: Request, _schema: unknown, _label: string) => ({
      success: true,
      data: JSON.parse(await _req.text()),
    }),
  ),
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
}));

import { PATCH } from "./+server";

const VALID_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const TARGET_USER_ID = "33333333-3333-3333-3333-333333333333";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeEvent(
  id: string,
  body: Record<string, unknown> | null = null,
  overrides: Record<string, unknown> = {},
) {
  return {
    params: { id },
    locals: makeLocals(null),
    url: new URL(`http://localhost/api/admin/counters/${id}/owner`),
    request: new Request(`http://localhost/api/admin/counters/${id}/owner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body !== null ? JSON.stringify(body) : JSON.stringify({}),
    }),
    ...overrides,
  } as unknown as Parameters<typeof PATCH>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/counters/[id]/owner", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(
      PATCH(makeEvent(VALID_ID, { ownerId: TARGET_USER_ID })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns 403 when user lacks user:manage permission", async () => {
    mockHasPermission.mockResolvedValue(false);

    await expect(
      PATCH(
        makeEvent(
          VALID_ID,
          { ownerId: TARGET_USER_ID },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(mockHasPermission).toHaveBeenCalledWith(USER_ID, "user:manage");
  });

  it("returns 400 for invalid counter ID format", async () => {
    mockHasPermission.mockResolvedValue(true);

    await expect(
      PATCH(
        makeEvent(
          "not-a-uuid",
          { ownerId: TARGET_USER_ID },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns 404 when target user not found", async () => {
    mockHasPermission.mockResolvedValue(true);
    mockDbSelect.mockResolvedValue([]);

    await expect(
      PATCH(
        makeEvent(
          VALID_ID,
          { ownerId: TARGET_USER_ID },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 when counter not found", async () => {
    mockHasPermission.mockResolvedValue(true);
    mockDbSelect.mockResolvedValue([{ id: TARGET_USER_ID }]);
    mockTransferCounterOwnership.mockResolvedValue(null);

    await expect(
      PATCH(
        makeEvent(
          VALID_ID,
          { ownerId: TARGET_USER_ID },
          { locals: makeLocals(USER_ID) },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect(mockTransferCounterOwnership).toHaveBeenCalledWith(
      VALID_ID,
      TARGET_USER_ID,
    );
  });

  it("successfully transfers ownership to a user", async () => {
    const updatedCounter = {
      id: VALID_ID,
      ownerId: TARGET_USER_ID,
      title: "Test Counter",
      count: 5,
    };

    mockHasPermission.mockResolvedValue(true);
    mockDbSelect.mockResolvedValue([{ id: TARGET_USER_ID }]);
    mockTransferCounterOwnership.mockResolvedValue(updatedCounter);

    const response = await PATCH(
      makeEvent(
        VALID_ID,
        { ownerId: TARGET_USER_ID },
        { locals: makeLocals(USER_ID) },
      ),
    );
    const body = await response.json();

    expect(body).toEqual(updatedCounter);
    expect(mockTransferCounterOwnership).toHaveBeenCalledWith(
      VALID_ID,
      TARGET_USER_ID,
    );
  });

  it("successfully removes ownership (ownerId: null)", async () => {
    const updatedCounter = {
      id: VALID_ID,
      ownerId: null,
      title: "Test Counter",
      count: 5,
    };

    mockHasPermission.mockResolvedValue(true);
    mockTransferCounterOwnership.mockResolvedValue(updatedCounter);

    const response = await PATCH(
      makeEvent(VALID_ID, { ownerId: null }, { locals: makeLocals(USER_ID) }),
    );
    const body = await response.json();

    expect(body).toEqual(updatedCounter);
    expect(mockTransferCounterOwnership).toHaveBeenCalledWith(VALID_ID, null);
    // Should NOT check user existence when ownerId is null
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});
