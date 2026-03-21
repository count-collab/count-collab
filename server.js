import http from "node:http";
import { Server } from "socket.io";
import { handler } from "./build/handler.js";

const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

const server = http.createServer(handler);

const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("[socket.io] Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("[socket.io] Client disconnected:", socket.id);
  });
});

// Expose the io instance globally so SvelteKit server code can emit events
globalThis.__socketIO = io;

server.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
