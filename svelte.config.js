import adapter from "@sveltejs/adapter-node";
import { cspConfig } from "./src/lib/server/csp.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $lib: "src/lib",
    },
    paths: {
      relative: false,
    },
    csp: cspConfig,
  },
};

export default config;
