import { sveltekit } from "@sveltejs/kit/vite";
import type { ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";

function socketIOPlugin() {
  return {
    name: "socket-io",
    async configureServer(server: ViteDevServer) {
      if (!server.httpServer) return;

      // ssrLoadModule resolves $lib and shares the SSR module graph
      const { initializeSocket } = await server.ssrLoadModule(
        "/src/lib/server/socket-server.ts",
      );
      initializeSocket(server.httpServer as import("node:http").Server);
    },
  };
}

export default defineConfig({
  plugins: [sveltekit(), socketIOPlugin()],
  ...(process.env.VITEST ? { resolve: { conditions: ["browser"] } } : {}),
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
    setupFiles: ["src/test-setup.ts"],
  },
});
