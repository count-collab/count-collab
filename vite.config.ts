import { sveltekit } from "@sveltejs/kit/vite";
import type { ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";

function socketIOPlugin() {
  return {
    name: "socket-io",
    async configureServer(server: ViteDevServer) {
      if (!server.httpServer) return;

      const { initializeSocket } =
        await import("./src/lib/utils/socket-dev.js");
      initializeSocket(server.httpServer as import("node:http").Server);
    },
  };
}

export default defineConfig({
  plugins: [sveltekit(), socketIOPlugin()],
  resolve: {
    conditions: process.env.VITEST ? ["browser"] : [],
  },
  server: {
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5174,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "jsdom",
    globalSetup: ["src/test-global-setup.ts"],
  },
});
