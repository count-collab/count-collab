// Socket.IO server for dev (Vite plugin via ssrLoadModule) and production (server.js).
// server.js is plain JS and cannot import `$lib` modules, so this module registers
// `globalThis.__socketGateway` when the SvelteKit bundle loads (see auth.ts) and
// server.js calls `initializeSocket` through it.

import type { Server as HTTPServer, IncomingMessage } from "node:http";
import { Server, type Socket } from "socket.io";
import { logger } from "$lib/server/logger";
import {
  authorizeSubscription,
  subscribeRequestSchema,
} from "$lib/server/socket-authorize";
import { resolveSessionUserId } from "$lib/server/socket-session";
import { roomForSubscription, userRoom } from "$lib/utils/socket-rooms";

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const SOCKET_CONFIG = {
  maxHttpBufferSize: envInt("SOCKET_MAX_HTTP_BUFFER_SIZE", 10_000),
  connectTimeoutMs: envInt("SOCKET_CONNECT_TIMEOUT_MS", 10_000),
  maxRoomsPerSocket: envInt("SOCKET_MAX_ROOMS_PER_SOCKET", 200),
  // Token bucket for subscribe/unsubscribe events per socket
  subscribeBurst: envInt("SOCKET_SUBSCRIBE_BURST", 100),
  subscribeRefillPerMinute: envInt("SOCKET_SUBSCRIBE_REFILL_PER_MINUTE", 60),
  // Rate-limited events tolerated before the socket is disconnected
  maxRateLimitViolations: envInt("SOCKET_MAX_RATE_LIMIT_VIOLATIONS", 20),
};

declare global {
  var __socketGateway:
    | { initializeSocket: (httpServer: HTTPServer) => Server }
    | undefined;
}

export function createTokenBucket(
  capacity: number,
  refillPerMinute: number,
  now: () => number = Date.now,
): { take: () => boolean } {
  let tokens = capacity;
  let last = now();

  return {
    take() {
      const current = now();
      tokens = Math.min(
        capacity,
        tokens + ((current - last) / 60_000) * refillPerMinute,
      );
      last = current;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}

export type OriginPolicy = {
  allowedOrigins: string[];
  /** Allow localhost origins (dev servers on any port). */
  allowLocalhost: boolean;
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Browsers send Origin on WebSocket upgrades and cross-origin requests, but not
 * on same-origin GETs (the initial long-polling request), so a missing Origin is
 * allowed. Browsers always add Sec-Fetch-Site, which lets us still reject a
 * cross-site request that carries cookies without an Origin. Non-browser clients
 * send neither header and cannot ride a victim's cookies.
 */
export function isOriginAllowed(
  origin: string | undefined,
  host: string | undefined,
  policy: OriginPolicy,
  secFetchSite?: string,
): boolean {
  if (!origin) {
    return (
      !secFetchSite ||
      secFetchSite === "same-origin" ||
      secFetchSite === "none"
    );
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (policy.allowedOrigins.includes(url.origin)) return true;
  if (host && url.host === host) return true;
  return policy.allowLocalhost && LOCAL_HOSTNAMES.has(url.hostname);
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

function buildOriginPolicy(env: NodeJS.ProcessEnv): OriginPolicy {
  const configured = [env.ORIGIN, ...(env.ALLOWED_ORIGINS?.split(",") ?? [])]
    .map((value) => (value ? normalizeOrigin(value) : null))
    .filter((value): value is string => !!value);

  return {
    allowedOrigins: configured,
    allowLocalhost: env.NODE_ENV !== "production",
  };
}

function requestHost(req: IncomingMessage, env: NodeJS.ProcessEnv) {
  // Same header override adapter-node honours behind a reverse proxy
  const hostHeader = env.HOST_HEADER?.toLowerCase();
  const forwarded = hostHeader ? req.headers[hostHeader] : undefined;
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value ?? req.headers.host;
}

type Ack = (response: { ok: boolean }) => void;

function reply(ack: unknown, ok: boolean): void {
  if (typeof ack === "function") (ack as Ack)({ ok });
}

function attachConnectionHandlers(socket: Socket): void {
  const userId: string | null = socket.data.userId ?? null;
  if (userId) socket.join(userRoom(userId));

  logger.debug("Socket connected", { id: socket.id, authenticated: !!userId });

  const bucket = createTokenBucket(
    SOCKET_CONFIG.subscribeBurst,
    SOCKET_CONFIG.subscribeRefillPerMinute,
  );
  let violations = 0;

  // Returns false (and replies) when the event must be dropped
  function admit(ack: unknown): boolean {
    if (bucket.take()) return true;

    violations += 1;
    reply(ack, false);
    if (violations >= SOCKET_CONFIG.maxRateLimitViolations) {
      logger.warn("Socket disconnected for exceeding subscribe rate limit", {
        id: socket.id,
      });
      socket.disconnect(true);
    }
    return false;
  }

  socket.on("subscribe", async (payload: unknown, ack: unknown) => {
    if (!admit(ack)) return;

    const parsed = subscribeRequestSchema.safeParse(payload);
    if (!parsed.success) return reply(ack, false);

    const request = parsed.data;
    const room = roomForSubscription(request.type, request.id);
    if (
      !socket.rooms.has(room) &&
      socket.rooms.size >= SOCKET_CONFIG.maxRoomsPerSocket
    ) {
      return reply(ack, false);
    }

    const allowed = await authorizeSubscription(userId, request);
    if (!allowed || socket.disconnected) return reply(ack, false);

    // Concurrent subscribes all pass the first cap check while authorizing
    if (
      !socket.rooms.has(room) &&
      socket.rooms.size >= SOCKET_CONFIG.maxRoomsPerSocket
    ) {
      return reply(ack, false);
    }

    await socket.join(room);
    reply(ack, true);
  });

  socket.on("unsubscribe", async (payload: unknown, ack: unknown) => {
    if (!admit(ack)) return;

    const parsed = subscribeRequestSchema.safeParse(payload);
    if (!parsed.success) return reply(ack, false);

    await socket.leave(roomForSubscription(parsed.data.type, parsed.data.id));
    reply(ack, true);
  });

  socket.on("disconnect", () => {
    logger.debug("Socket disconnected", { id: socket.id });
  });
}

let io: Server | null = null;

export function initializeSocket(httpServer: HTTPServer): Server {
  if (io) return io;
  if (globalThis.__socketIO) {
    io = globalThis.__socketIO;
    return io;
  }

  io = createSocketServer(httpServer);

  // Expose globally so SSR route handlers (separate module graph in dev)
  // can reach the same instance via getIO().
  globalThis.__socketIO = io;

  return io;
}

export function createSocketServer(
  httpServer: HTTPServer,
  env: NodeJS.ProcessEnv = process.env,
): Server {
  const originPolicy = buildOriginPolicy(env);
  const corsOrigins =
    env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ??
    (env.NODE_ENV === "production" ? [] : ["http://localhost:5173"]);

  const server = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    maxHttpBufferSize: SOCKET_CONFIG.maxHttpBufferSize,
    connectTimeout: SOCKET_CONFIG.connectTimeoutMs,
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      const secFetchSite = req.headers["sec-fetch-site"];
      const allowed = isOriginAllowed(
        Array.isArray(origin) ? origin[0] : origin,
        requestHost(req, env),
        originPolicy,
        Array.isArray(secFetchSite) ? secFetchSite[0] : secFetchSite,
      );
      if (!allowed) logger.warn("Socket request rejected: origin not allowed");
      callback(null, allowed);
    },
  });

  server.use(async (socket, next) => {
    try {
      socket.data.userId = await resolveSessionUserId(
        socket.handshake.headers.cookie,
      );
      next();
    } catch (err) {
      logger.error("Socket session lookup failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      next(new Error("auth_unavailable"));
    }
  });

  server.on("connection", attachConnectionHandlers);

  return server;
}

globalThis.__socketGateway = { initializeSocket };
