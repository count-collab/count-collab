#!/usr/bin/env node

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

let commit = "unknown";
let branch = "unknown";

try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  branch = execSync("git rev-parse --abbrev-ref HEAD", {
    encoding: "utf-8",
  }).trim();
} catch (error) {
  console.warn(
    "Git information not available:",
    error instanceof Error ? error.message : String(error),
  );
}

const buildInfo = {
  version: packageJson.version,
  commit,
  branch,
  buildTime: new Date().toISOString(),
  buildTimestamp: Date.now(),
};

// Ensure the build directory exists
mkdirSync("build", { recursive: true });

// Write build info as both JSON and JavaScript
writeFileSync("build/build-info.json", JSON.stringify(buildInfo, null, 2));
writeFileSync(
  "build/build-info.js",
  `export const buildInfo = ${JSON.stringify(buildInfo, null, 2)};`,
);

console.log("✓ Build info generated:", buildInfo);
