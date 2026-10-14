// @vitest-environment node
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server as SocketServer } from "socket.io";
import { type Socket as ClientSocket, io as connectClient } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockWhere,
  mockResolveSessionUserId,
  mockCanViewPrivateCounter,
} = vi.hoisted(() => ({
  mockWhere: vi.fn(),
  mockResolveSessionUserId: vi.fn(),
  mockCanViewPrivateCounter: vi.fn(),
}));

vi.mock("$lib/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: mockWhere }) }),
  },
}));

vi.mock("$lib/server/authorize", () => ({
  canViewPrivateCounter: mockCanViewPrivateCounter,
}));

vi.mock("$lib/server/dashboard-authorize", () => ({
  canViewDashboard: vi.fn().mockResolvedValue(false),
}));

vi.mock("$lib/server/team-authorize", () => ({
  canViewTeam: vi.fn().mockResolvedValue(false),
}));

vi.mock("$lib/server/socket-session", () => ({
  resolveSessionUserId: mockResolveSessionUserId,
}));

vi.mock("$lib/server/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  counterRoom,
  userRoom,
} from "$lib/utils/socket-rooms";
import {
  createSocketServer,
  createTokenBucket,
  isOriginAllowed,
  type OriginPolicy,
  SOCKET_CONFIG,
} from "./socket-server";

describe("isOriginAllowed", () => {
  const policy: OriginPolicy = {
    allowedOrigins: ["https://app.example.com"],
    allowLocalhost: false,
  };

  it("allows configured origins, normalised to scheme+host+port", () => {
    expect(isOriginAllowed("https://app.example.com", "x", policy)).toBe(true);
  });

  it("allows the request's own host (same-origin behind the proxy)", () => {
    expect(
      isOriginAllowed("https://other.example.com", "other.example.com", policy),
    ).toBe(true);
  });

  it("rejects foreign origins", () => {
    expect(
      isOriginAllowed("https://evil.example.com", "app.example.com", policy),
    ).toBe(false);
  });

  it("does not match on scheme or port differences", () => {
    expect(isOriginAllowed("http://app.example.com", "x", policy)).toBe(false);
    expect(isOriginAllowed("https://app.example.com:8443", "x", policy)).toBe(
      false,
    );
  });

  it("does not accept look-alike hosts", () => {
    expect(
      isOriginAllowed("https://app.example.com.evil.io", "x", policy),
    ).toBe(false);
    expect(isOriginAllowed("https://evilapp.example.com", "x", policy)).toBe(
      false,
    );
  });

  it("rejects the opaque and malformed Origin values", () => {
    expect(isOriginAllowed("null", "x", policy)).toBe(false);
    expect(isOriginAllowed("not a url", "x", policy)).toBe(false);
  });

  it("allows localhost origins only when the policy says so", () => {
    expect(isOriginAllowed("http://localhost:5173", "x", policy)).toBe(false);
    expect(
      isOriginAllowed("http://localhost:5173", "x", {
        ...policy,
        allowLocalhost: true,
      }),
    ).toBe(true);
    expect(
      isOriginAllowed("http://127.0.0.1:3000", "x", {
        ...policy,
        allowLocalhost: true,
      }),
    ).toBe(true);
  });

  describe("without an Origin header", () => {
    it("allows non-browser clients (no Sec-Fetch-Site)", () => {
      expect(isOriginAllowed(undefined, "x", policy)).toBe(true);
    });

    it.each(["same-origin", "none"])("allows Sec-Fetch-Site: %s", (site) => {
      expect(isOriginAllowed(undefined, "x", policy, site)).toBe(true);
    });

    it.each(["cross-site", "same-site"])(
      "rejects Sec-Fetch-Site: %s so cookies can't ride a cross-site request",
      (site) => {
        expect(isOriginAllowed(undefined, "x", policy, site)).toBe(false);
      },
    );
  });
});

describe("createTokenBucket", () => {
  it("allows a burst up to capacity, then refuses", () => {
    const bucket = createTokenBucket(3, 60, () => 0);

    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual(
      [true, true, true, false],
    );
  });

  it("refills at the configured rate per minute", () => {
    let now = 0;
    const bucket = createTokenBucket(2, 60, () => now);
    bucket.take();
    bucket.take();
    expect(bucket.take()).toBe(false);

    now = 999;
    expect(bucket.take()).toBe(false);
    now = 1000;
    expect(bucket.take()).toBe(true);
    expect(bucket.take()).toBe(false);
  });

  it("never accumulates more than its capacity", () => {
    let now = 0;
    const bucket = createTokenBucket(2, 60, () => now);
    now = 10 * 60_000;

    expect([bucket.take(), bucket.take(), bucket.take()]).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe("socket server", () => {
  const COUNTER_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
  const TOKEN = "s".repeat(32);
  const ORIGIN = "https://app.example.com";
  const defaults = { ...SOCKET_CONFIG };

  let httpServer: HttpServer;
  let io: SocketServer;
  let url: string;
  const clients: ClientSocket[] = [];

  function connect(headers: Record<string, string> = {}) {
    const client = connectClient(url, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      extraHeaders: headers,
    });
    clients.push(client);
    return new Promise<ClientSocket>((resolve, reject) => {
      client.once("connect", () => resolve(client));
      client.once("connect_error", reject);
    });
  }

  const asUser = (userId: string) => connect({ cookie: `uid=${userId}` });

  const subscribe = (client: ClientSocket, payload: unknown) =>
    client.emitWithAck("subscribe", payload) as Promise<{ ok: boolean }>;

  function record(client: ClientSocket, event: string) {
    const received: unknown[] = [];
    client.on(event, (data) => received.push(data));
    return received;
  }

  /** Acks arrive after earlier broadcasts on the same connection, so this flushes them. */
  const flush = (client: ClientSocket) => subscribe(client, { type: "feed" });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockWhere.mockResolvedValue([
      { visibilityMode: "private", shareToken: TOKEN },
    ]);
    mockCanViewPrivateCounter.mockImplementation(
      async (userId: string) => userId === "owner",
    );
    mockResolveSessionUserId.mockImplementation(
      async (cookie: string | undefined) => {
        const uid = cookie?.match(/uid=([^;]+)/)?.[1] ?? null;
        if (uid === "boom") throw new Error("db down");
        return uid;
      },
    );

    httpServer = createServer();
    io = createSocketServer(httpServer, {
      NODE_ENV: "production",
      ORIGIN,
    } as NodeJS.ProcessEnv);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    Object.assign(SOCKET_CONFIG, defaults);
    for (const client of clients.splice(0)) client.disconnect();
    await io.close();
  });

  describe("origin policy", () => {
    it("accepts a client from the configured origin", async () => {
      await expect(connect({ origin: ORIGIN })).resolves.toBeDefined();
    });

    it("accepts a non-browser client without Origin", async () => {
      await expect(connect()).resolves.toBeDefined();
    });

    it("refuses a foreign origin", async () => {
      await expect(connect({ origin: "https://evil.example.com" })).rejects.toBeDefined();
    });

    it("refuses localhost origins in production", async () => {
      await expect(connect({ origin: "http://localhost:5173" })).rejects.toBeDefined();
    });

    it("refuses a cross-site browser request that carries no Origin", async () => {
      await expect(connect({ "sec-fetch-site": "cross-site" })).rejects.toBeDefined();
    });
  });

  it("refuses the connection when the session lookup fails", async () => {
    await expect(asUser("boom")).rejects.toMatchObject({
      message: "auth_unavailable",
    });
  });

  describe("subscribe authorization", () => {
    const counter = { type: "counter", id: COUNTER_ID };

    it("delivers private counter events only to authorized sockets", async () => {
      const owner = await asUser("owner");
      const stranger = await asUser("stranger");
      const anonymous = await connect();
      const wrongToken = await connect();
      const withToken = await connect();

      const events = {
        owner: record(owner, "counter:update"),
        stranger: record(stranger, "counter:update"),
        anonymous: record(anonymous, "counter:update"),
        wrongToken: record(wrongToken, "counter:update"),
        withToken: record(withToken, "counter:update"),
      };

      const acks = await Promise.all([
        subscribe(owner, counter),
        subscribe(stranger, counter),
        subscribe(anonymous, counter),
        subscribe(wrongToken, { ...counter, token: "x".repeat(32) }),
        subscribe(withToken, { ...counter, token: TOKEN }),
      ]);
      expect(acks).toEqual([
        { ok: true },
        { ok: false },
        { ok: false },
        { ok: false },
        { ok: true },
      ]);

      io.to(counterRoom(COUNTER_ID)).emit("counter:update", { count: 42 });
      await Promise.all(
        [owner, stranger, anonymous, wrongToken, withToken].map(flush),
      );

      expect(events.owner).toEqual([{ count: 42 }]);
      expect(events.withToken).toEqual([{ count: 42 }]);
      expect(events.stranger).toEqual([]);
      expect(events.anonymous).toEqual([]);
      expect(events.wrongToken).toEqual([]);
    });

    it("answers a missing counter exactly like a forbidden one", async () => {
      const stranger = await asUser("stranger");
      const forbidden = await subscribe(stranger, counter);

      mockWhere.mockResolvedValue([]);
      const missing = await subscribe(stranger, counter);

      expect(forbidden).toEqual({ ok: false });
      expect(missing).toEqual(forbidden);
    });

    it("lets everyone follow a public counter", async () => {
      mockWhere.mockResolvedValue([
        { visibilityMode: "public", shareToken: null },
      ]);
      const anonymous = await connect();
      const received = record(anonymous, "counter:update");

      await expect(subscribe(anonymous, counter)).resolves.toEqual({ ok: true });
      io.to(counterRoom(COUNTER_ID)).emit("counter:update", { count: 1 });
      await flush(anonymous);

      expect(received).toEqual([{ count: 1 }]);
    });

    it("stops delivery after unsubscribing", async () => {
      const owner = await asUser("owner");
      const received = record(owner, "counter:update");
      await subscribe(owner, counter);

      await expect(owner.emitWithAck("unsubscribe", counter)).resolves.toEqual({
        ok: true,
      });
      io.to(counterRoom(COUNTER_ID)).emit("counter:update", { count: 1 });
      await flush(owner);

      expect(received).toEqual([]);
    });

    it.each([
      ["a user room", { type: "user", id: "owner" }],
      ["a raw room name", { room: "user:owner" }],
      ["a malformed id", { type: "counter", id: "not-a-uuid" }],
      ["extra keys", { type: "feed", extra: true }],
      ["a non-object payload", "counter:1"],
    ])("rejects %s without joining anything", async (_, payload) => {
      const stranger = await asUser("stranger");

      await expect(subscribe(stranger, payload)).resolves.toEqual({ ok: false });
    });

    it("joins signed-in sockets to their own user room only", async () => {
      const alice = await asUser("alice");
      const bob = await asUser("bob");
      const anonymous = await connect();
      const received = {
        alice: record(alice, "invitation:created"),
        bob: record(bob, "invitation:created"),
        anonymous: record(anonymous, "invitation:created"),
      };

      io.to(userRoom("alice")).emit("invitation:created", { id: 1 });
      await Promise.all([alice, bob, anonymous].map(flush));

      expect(received.alice).toEqual([{ id: 1 }]);
      expect(received.bob).toEqual([]);
      expect(received.anonymous).toEqual([]);
    });

    it("does not crash on a subscribe without an ack callback", async () => {
      const anonymous = await connect();
      anonymous.emit("subscribe", { type: "feed" });

      await expect(flush(anonymous)).resolves.toEqual({ ok: true });
    });
  });

  describe("room cap", () => {
    it("refuses new rooms past the per-socket cap but still allows re-subscribing", async () => {
      mockWhere.mockResolvedValue([
        { visibilityMode: "public", shareToken: null },
      ]);
      // An anonymous socket already sits in its own id room
      SOCKET_CONFIG.maxRoomsPerSocket = 3;
      const anonymous = await connect();
      const id = (n: number) => `3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4${n}`;

      await expect(
        subscribe(anonymous, { type: "counter", id: id(1) }),
      ).resolves.toEqual({ ok: true });
      await expect(
        subscribe(anonymous, { type: "counter", id: id(2) }),
      ).resolves.toEqual({ ok: true });
      await expect(
        subscribe(anonymous, { type: "counter", id: id(3) }),
      ).resolves.toEqual({ ok: false });
      await expect(
        subscribe(anonymous, { type: "counter", id: id(1) }),
      ).resolves.toEqual({ ok: true });
    });

    it("frees capacity on unsubscribe", async () => {
      SOCKET_CONFIG.maxRoomsPerSocket = 2;
      const anonymous = await connect();

      await expect(subscribe(anonymous, { type: "feed" })).resolves.toEqual({
        ok: true,
      });
      await expect(
        subscribe(anonymous, { type: "counter", id: COUNTER_ID, token: TOKEN }),
      ).resolves.toEqual({ ok: false });

      await anonymous.emitWithAck("unsubscribe", { type: "feed" });
      await expect(
        subscribe(anonymous, { type: "counter", id: COUNTER_ID, token: TOKEN }),
      ).resolves.toEqual({ ok: true });
    });
  });

  describe("subscribe rate limit", () => {
    it("refuses events past the burst and disconnects repeat offenders", async () => {
      SOCKET_CONFIG.subscribeBurst = 3;
      SOCKET_CONFIG.subscribeRefillPerMinute = 1;
      SOCKET_CONFIG.maxRateLimitViolations = 2;
      const client = await connect();
      const disconnected = new Promise<string>((resolve) =>
        client.once("disconnect", resolve),
      );

      const acks = [];
      for (let i = 0; i < 5; i++) {
        acks.push(await subscribe(client, { type: "feed" }));
      }

      expect(acks.map((a) => a.ok)).toEqual([true, true, true, false, false]);
      await expect(disconnected).resolves.toBe("io server disconnect");
    });

    it("counts unsubscribes against the same budget", async () => {
      SOCKET_CONFIG.subscribeBurst = 2;
      SOCKET_CONFIG.subscribeRefillPerMinute = 1;
      SOCKET_CONFIG.maxRateLimitViolations = 100;
      const client = await connect();

      await subscribe(client, { type: "feed" });
      await client.emitWithAck("unsubscribe", { type: "feed" });

      await expect(subscribe(client, { type: "feed" })).resolves.toEqual({
        ok: false,
      });
      await expect(
        client.emitWithAck("unsubscribe", { type: "feed" }),
      ).resolves.toEqual({ ok: false });
    });

    it("keeps budgets per socket", async () => {
      SOCKET_CONFIG.subscribeBurst = 1;
      SOCKET_CONFIG.subscribeRefillPerMinute = 1;
      SOCKET_CONFIG.maxRateLimitViolations = 100;
      const a = await connect();
      const b = await connect();

      await subscribe(a, { type: "feed" });

      await expect(subscribe(a, { type: "feed" })).resolves.toEqual({ ok: false });
      await expect(subscribe(b, { type: "feed" })).resolves.toEqual({ ok: true });
    });
  });
});
