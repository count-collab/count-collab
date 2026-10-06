import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckTeamCreationRateLimit, mockCreateTeam, mockListUserTeams } =
  vi.hoisted(() => ({
    mockCheckTeamCreationRateLimit: vi.fn(),
    mockCreateTeam: vi.fn(),
    mockListUserTeams: vi.fn(),
  }));

vi.mock("$lib/server/ratelimit", () => ({
  checkTeamCreationRateLimit: mockCheckTeamCreationRateLimit,
}));

vi.mock("$lib/server/teams", () => ({
  createTeam: mockCreateTeam,
  listUserTeams: mockListUserTeams,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { GET, POST } from "./+server";

function makeLocals(userId: string | null) {
  return {
    auth: vi.fn(async () =>
      userId ? { user: { id: userId } } : { user: null },
    ),
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckTeamCreationRateLimit.mockResolvedValue(null);
});

describe("GET /api/teams", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(
      GET({ locals: makeLocals(null) } as any),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("returns the user's teams", async () => {
    mockListUserTeams.mockResolvedValue([{ id: "t1", role: "owner" }]);

    const response = await GET({ locals: makeLocals("user-1") } as any);

    expect(await response.json()).toEqual([{ id: "t1", role: "owner" }]);
    expect(mockListUserTeams).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/teams", () => {
  it("returns 401 when not authenticated", async () => {
    await expect(
      POST({
        request: makeRequest({ name: "Team" }),
        locals: makeLocals(null),
      } as any),
    ).rejects.toMatchObject({ status: 401 });
    expect(mockCreateTeam).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    mockCheckTeamCreationRateLimit.mockResolvedValue({ retryAfter: 42 });

    const response = await POST({
      request: makeRequest({ name: "Team" }),
      locals: makeLocals("user-1"),
    } as any);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(mockCheckTeamCreationRateLimit).toHaveBeenCalledWith("user-1");
    expect(mockCreateTeam).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty name", async () => {
    const response = await POST({
      request: makeRequest({ name: "   " }),
      locals: makeLocals("user-1"),
    } as any);

    expect(response.status).toBe(400);
    expect(mockCreateTeam).not.toHaveBeenCalled();
  });

  it("creates the team and responds 201", async () => {
    mockCreateTeam.mockResolvedValue({ id: "t1", name: "Team" });

    const response = await POST({
      request: makeRequest({ name: " Team ", description: "" }),
      locals: makeLocals("user-1"),
    } as any);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "t1", name: "Team" });
    expect(mockCreateTeam).toHaveBeenCalledWith({
      name: "Team",
      description: null,
      userId: "user-1",
    });
  });
});
