// Accessor for the Socket.IO server created by `$lib/server/socket-server`
// (dev: Vite plugin, production: server.js).

import type { Server } from "socket.io";

declare global {
  var __socketIO: Server | undefined;
}

export function getIO(): Server | null {
  return globalThis.__socketIO ?? null;
}
