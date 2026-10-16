import http from "node:http";
import { handler } from "./build/handler.js";

const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

const server = http.createServer(handler);

// Auth, rooms, origin checks and limits live in src/lib/server/socket-server.ts.
// It is part of the SvelteKit build (loaded via hooks.server.ts -> auth.ts) and
// registers itself on globalThis because server.js cannot import $lib modules.
const gateway = globalThis.__socketGateway;
if (!gateway) {
  throw new Error(
    "Socket gateway not registered: the SvelteKit server bundle did not load.",
  );
}

// Also exposes the instance as globalThis.__socketIO for SvelteKit emitters
gateway.initializeSocket(server);

server.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
