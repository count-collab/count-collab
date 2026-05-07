import { io, type Socket } from "socket.io-client";
import { browser } from "$app/environment";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (!browser) return null;

  if (socket) return socket;

  socket = io({ path: "/socket.io" });

  return socket;
}
