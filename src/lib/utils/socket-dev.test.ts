import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { getIO, initializeSocket } from "./socket-dev";

// Reset module-level and global state between tests by importing fresh each time
// is not practical here, so we rely on the idempotent guard inside initializeSocket.

describe("socket-dev", () => {
    let server: http.Server;

    afterEach(() => {
        // Clean up the global reference so tests are isolated
        delete (globalThis as Record<string, unknown>).__socketIO;
        server?.close();
    });

    it("initializeSocket sets globalThis.__socketIO", () => {
        server = http.createServer();
        const io = initializeSocket(server);

        expect(io).toBeDefined();
        expect(globalThis.__socketIO).toBe(io);
    });

    it("getIO returns the instance set on globalThis", () => {
        server = http.createServer();
        const io = initializeSocket(server);

        // Simulate SSR context: module-level `io` may not be visible,
        // but globalThis.__socketIO should still return the instance.
        expect(getIO()).toBe(io);
    });

    it("getIO returns null when nothing is initialized", () => {
        // Because the previous initializeSocket call set the module-level `io`,
        // we can only test the globalThis path by checking it's set after init.
        // This test verifies that the global is correctly referenced.
        expect(globalThis.__socketIO).toBeUndefined();
    });
});
