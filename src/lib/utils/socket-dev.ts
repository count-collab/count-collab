// Socket.IO server initializer for dev (Vite plugin) and production.
// This file uses relative imports so it can be loaded from vite.config.ts.

import type { Server as HTTPServer } from "node:http";
import { Server } from "socket.io";

declare global {
  // Set by server.js in production
  var __socketIO: Server | undefined;
}

let io: Server | null = null;

export function initializeSocket(httpServer: HTTPServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") || [
        "http://localhost:5173",
      ],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("[socket.io] Client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("[socket.io] Client disconnected:", socket.id);
    });
  });

  // Expose globally so SSR route handlers (which run in a separate
  // Vite module graph) can reach the same instance via getIO().
  globalThis.__socketIO = io;

  return io;
}

export function getIO(): Server | null {
  return io ?? globalThis.__socketIO ?? null;
}
