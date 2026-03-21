import http from "node:http";
import { Server } from "socket.io";
import { handler } from "./build/handler.js";

const isProduction = process.env.NODE_ENV === "production";

// --- Startup validation (production only) ---
if (isProduction) {
  const required = ["DATABASE_URL", "ALLOWED_ORIGINS", "AUTH_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `[FATAL] Missing required environment variables: ${missing.join(", ")}`,
    );
    console.error(
      "Set these variables before starting the server in production.",
    );
    process.exit(1);
  }
}

const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || [];

if (isProduction && allowedOrigins.length === 0) {
  console.error("[FATAL] ALLOWED_ORIGINS must contain at least one origin.");
  process.exit(1);
}

const server = http.createServer(handler);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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
