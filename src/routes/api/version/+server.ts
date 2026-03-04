import { json } from "@sveltejs/kit";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { RequestHandler } from "./$types";

interface BuildInfo {
  version: string;
  commit: string;
  branch: string;
  buildTime: string;
  buildTimestamp: number;
}

let buildInfo: BuildInfo | null = null;

// Try to load build info on first request
function loadBuildInfo(): BuildInfo {
  if (buildInfo) {
    return buildInfo;
  }

  try {
    const buildInfoPath = resolve("build/build-info.json");
    const data = readFileSync(buildInfoPath, "utf-8");
    const parsed: BuildInfo = JSON.parse(data);
    buildInfo = parsed;
    return parsed;
  } catch (error) {
    // Fall back to development defaults when build info is not available
    console.warn(
      "Build info file not found. Running in development mode.",
      error instanceof Error ? error.message : String(error),
    );

    return {
      version: "dev",
      commit: "unknown",
      branch: "unknown",
      buildTime: new Date().toISOString(),
      buildTimestamp: Date.now(),
    };
  }
}

export const GET: RequestHandler = async () => {
  const info = loadBuildInfo();

  return json(info, { status: 200 });
};
