import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateCounter, mockEmitCounterCreated } = vi.hoisted(() => ({
  mockCreateCounter: vi.fn(),
  mockEmitCounterCreated: vi.fn(),
}));

vi.mock("$lib/server/counters", () => ({
  createCounter: mockCreateCounter,
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
  emitCounterCreated: mockEmitCounterCreated,
}));

vi.mock("$lib/utils/validation", () => ({
  createCounterSchema: {},
}));

import { POST } from "./+server";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

describe("POST /create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("coerces anonymous public_readonly submissions to public", async () => {
    mockCreateCounter.mockResolvedValue({ id: "test-id" });

    const request = makeRequest({
      title: "Read Only Counter",
      description: "",
      visibility: "public_readonly",
    });

    await POST({
      request,
      locals: makeLocals(null),
    } as any);

    expect(mockCreateCounter).toHaveBeenCalledWith(
      expect.objectContaining({
        visibilityMode: "public",
        ownerId: null,
      }),
    );
  });

  it("coerces anonymous private submissions to public", async () => {
    mockCreateCounter.mockResolvedValue({ id: "test-id" });

    const request = makeRequest({
      title: "Test Counter",
      description: "",
      visibility: "private",
    });

    await POST({
      request,
      locals: makeLocals(null),
    } as any);

    expect(mockCreateCounter).toHaveBeenCalledWith(
      expect.objectContaining({
        visibilityMode: "public",
        ownerId: null,
      }),
    );
  });

  it("allows authenticated users to create private counters", async () => {
    mockCreateCounter.mockResolvedValue({ id: "test-id" });

    const request = makeRequest({
      title: "Private Counter",
      description: "",
      visibility: "private",
    });

    await POST({
      request,
      locals: makeLocals("user-123"),
    } as any);

    expect(mockCreateCounter).toHaveBeenCalledWith(
      expect.objectContaining({
        visibilityMode: "private",
        ownerId: "user-123",
      }),
    );
  });

  it("allows authenticated users to create public read-only counters", async () => {
    mockCreateCounter.mockResolvedValue({ id: "test-id" });

    const request = makeRequest({
      title: "Public Read Only Counter",
      description: "",
      visibility: "public_readonly",
    });

    await POST({
      request,
      locals: makeLocals("user-789"),
    } as any);

    expect(mockCreateCounter).toHaveBeenCalledWith(
      expect.objectContaining({
        visibilityMode: "public_readonly",
        ownerId: "user-789",
      }),
    );
  });

  it("allows authenticated users to create public counters", async () => {
    mockCreateCounter.mockResolvedValue({ id: "test-id" });

    const request = makeRequest({
      title: "Public Counter",
      description: "",
      visibility: "public",
    });

    await POST({
      request,
      locals: makeLocals("user-456"),
    } as any);

    expect(mockCreateCounter).toHaveBeenCalledWith(
      expect.objectContaining({
        visibilityMode: "public",
        ownerId: "user-456",
      }),
    );
  });

  it("allows anonymous users to create public counters", async () => {
    mockCreateCounter.mockResolvedValue({ id: "test-id" });

    const request = makeRequest({
      title: "Anonymous Public Counter",
      description: "",
      visibility: "public",
    });

    await POST({
      request,
      locals: makeLocals(null),
    } as any);

    expect(mockCreateCounter).toHaveBeenCalledWith(
      expect.objectContaining({
        visibilityMode: "public",
        ownerId: null,
      }),
    );
  });

  it("returns 201 with the counter id", async () => {
    mockCreateCounter.mockResolvedValue({ id: "new-counter-id" });

    const request = makeRequest({
      title: "My Counter",
      description: "",
      visibility: "public",
    });

    const response = await POST({
      request,
      locals: makeLocals(null),
    } as any);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBe("new-counter-id");
  });
});
