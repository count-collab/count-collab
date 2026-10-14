import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockCanViewPrivateCounter,
  mockCanViewDashboard,
  mockCanViewTeam,
  mockWarn,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockCanViewPrivateCounter: vi.fn(),
  mockCanViewDashboard: vi.fn(),
  mockCanViewTeam: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock("$lib/db", () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
}));

vi.mock("$lib/server/authorize", () => ({
  canViewPrivateCounter: mockCanViewPrivateCounter,
}));

vi.mock("$lib/server/dashboard-authorize", () => ({
  canViewDashboard: mockCanViewDashboard,
}));

vi.mock("$lib/server/team-authorize", () => ({
  canViewTeam: mockCanViewTeam,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: mockWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  authorizeSubscription,
  subscribeRequestSchema,
} from "./socket-authorize";

const ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const TOKEN = "t".repeat(32);

const publicResource = { visibilityMode: "public", shareToken: null };
const privateResource = { visibilityMode: "private", shareToken: TOKEN };

function resourceIs(row: unknown) {
  mockWhere.mockResolvedValue(row ? [row] : []);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockCanViewPrivateCounter.mockResolvedValue(false);
  mockCanViewDashboard.mockResolvedValue(false);
  mockCanViewTeam.mockResolvedValue(false);
  resourceIs(null);
});

describe("subscribeRequestSchema", () => {
  it.each([
    [{ type: "feed" }],
    [{ type: "counter", id: ID }],
    [{ type: "dashboard", id: ID, token: TOKEN }],
    [{ type: "team", id: ID, token: null }],
  ])("accepts %j", (payload) => {
    expect(subscribeRequestSchema.safeParse(payload).success).toBe(true);
  });

  it.each([
    ["a user room", { type: "user", id: ID }],
    ["an unknown type", { type: "admin", id: ID }],
    ["a counter without an id", { type: "counter" }],
    ["a non-uuid id", { type: "counter", id: "../etc" }],
    ["an oversized token", { type: "counter", id: ID, token: "x".repeat(129) }],
    ["extra keys", { type: "feed", room: "user:1" }],
    ["a non-string token", { type: "counter", id: ID, token: 5 }],
    ["null", null],
    ["a string", "counter:1"],
  ])("rejects %s", (_, payload) => {
    expect(subscribeRequestSchema.safeParse(payload).success).toBe(false);
  });
});

describe("authorizeSubscription", () => {
  describe("feed", () => {
    it("is open to anonymous users without touching the database", async () => {
      await expect(authorizeSubscription(null, { type: "feed" })).resolves.toBe(
        true,
      );
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe("team", () => {
    it("denies anonymous users without a lookup", async () => {
      await expect(
        authorizeSubscription(null, { type: "team", id: ID }),
      ).resolves.toBe(false);
      expect(mockCanViewTeam).not.toHaveBeenCalled();
    });

    it("allows members and denies non-members", async () => {
      mockCanViewTeam.mockResolvedValueOnce(true);
      await expect(
        authorizeSubscription("u1", { type: "team", id: ID }),
      ).resolves.toBe(true);
      expect(mockCanViewTeam).toHaveBeenCalledWith("u1", ID);

      await expect(
        authorizeSubscription("u2", { type: "team", id: ID }),
      ).resolves.toBe(false);
    });

    it("ignores share tokens", async () => {
      await expect(
        authorizeSubscription(null, { type: "team", id: ID, token: TOKEN }),
      ).resolves.toBe(false);
    });
  });

  describe.each([
    ["counter", mockCanViewPrivateCounter],
    ["dashboard", mockCanViewDashboard],
  ] as const)("%s", (type, canView) => {
    const request = (token?: string | null) => ({ type, id: ID, token });

    it("lets anyone join a public resource", async () => {
      resourceIs(publicResource);

      await expect(authorizeSubscription(null, request())).resolves.toBe(true);
      await expect(authorizeSubscription("u1", request())).resolves.toBe(true);
      expect(canView).not.toHaveBeenCalled();
    });

    it("ignores a share token on a public resource", async () => {
      resourceIs(publicResource);

      await expect(authorizeSubscription(null, request("junk"))).resolves.toBe(
        true,
      );
    });

    it("denies an anonymous user on a private resource without a token", async () => {
      resourceIs(privateResource);

      await expect(authorizeSubscription(null, request())).resolves.toBe(false);
      await expect(authorizeSubscription(null, request(null))).resolves.toBe(
        false,
      );
      await expect(authorizeSubscription(null, request(""))).resolves.toBe(
        false,
      );
      expect(canView).not.toHaveBeenCalled();
    });

    it("allows an anonymous user holding the valid share token", async () => {
      resourceIs(privateResource);

      await expect(authorizeSubscription(null, request(TOKEN))).resolves.toBe(
        true,
      );
      expect(canView).not.toHaveBeenCalled();
    });

    it("denies an invalid share token (same length and different length)", async () => {
      resourceIs(privateResource);

      await expect(
        authorizeSubscription(null, request("x".repeat(32))),
      ).resolves.toBe(false);
      await expect(authorizeSubscription(null, request("short"))).resolves.toBe(
        false,
      );
    });

    it("denies any token when the private resource has no token stored", async () => {
      resourceIs({ visibilityMode: "private", shareToken: null });

      await expect(authorizeSubscription(null, request(TOKEN))).resolves.toBe(
        false,
      );
    });

    it("allows a user with access (owner, member or follower) without a token", async () => {
      resourceIs(privateResource);
      canView.mockResolvedValueOnce(true);

      await expect(authorizeSubscription("owner", request())).resolves.toBe(
        true,
      );
      expect(canView).toHaveBeenCalledWith("owner", ID);
    });

    it("denies a signed-in user without access", async () => {
      resourceIs(privateResource);

      await expect(authorizeSubscription("stranger", request())).resolves.toBe(
        false,
      );
      expect(canView).toHaveBeenCalledWith("stranger", ID);
    });

    it("falls back to account access when the share token is stale", async () => {
      resourceIs(privateResource);
      canView.mockResolvedValueOnce(true);

      await expect(
        authorizeSubscription("member", request("stale-token")),
      ).resolves.toBe(true);
    });

    it("answers a missing resource exactly like a forbidden one", async () => {
      resourceIs(privateResource);
      const forbidden = await authorizeSubscription("stranger", request());

      resourceIs(null);
      const missing = await authorizeSubscription("stranger", request());
      const missingAnon = await authorizeSubscription(null, request(TOKEN));

      expect(forbidden).toBe(false);
      expect(missing).toBe(forbidden);
      expect(missingAnon).toBe(forbidden);
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("does not consult the access check for a missing resource", async () => {
      resourceIs(null);

      await authorizeSubscription("owner", request());

      expect(canView).not.toHaveBeenCalled();
    });

    it("denies when the lookup fails and logs a warning without the error leaking out", async () => {
      mockWhere.mockRejectedValueOnce(new Error("db down"));

      await expect(authorizeSubscription("owner", request())).resolves.toBe(
        false,
      );
      expect(mockWarn).toHaveBeenCalledWith(
        "Socket subscribe authorization failed",
        expect.objectContaining({ type, error: "db down" }),
      );
    });

    it("denies when the access check throws", async () => {
      resourceIs(privateResource);
      canView.mockRejectedValueOnce(new Error("boom"));

      await expect(authorizeSubscription("owner", request())).resolves.toBe(
        false,
      );
    });
  });

  it("uses the dashboard access check only for dashboards and the counter one only for counters", async () => {
    resourceIs(privateResource);
    mockCanViewDashboard.mockResolvedValue(true);
    await expect(
      authorizeSubscription("u1", { type: "counter", id: ID }),
    ).resolves.toBe(false);

    mockCanViewDashboard.mockResolvedValue(false);
    mockCanViewPrivateCounter.mockResolvedValue(true);
    await expect(
      authorizeSubscription("u1", { type: "dashboard", id: ID }),
    ).resolves.toBe(false);
  });

  it("denies resource subscriptions without an id", async () => {
    await expect(
      authorizeSubscription("u1", { type: "counter" }),
    ).resolves.toBe(false);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
