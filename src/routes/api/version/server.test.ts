import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/build-info.generated", () => ({
  buildInfo: {
    version: "1.2.3",
    commit: "abc1234",
    branch: "main",
    buildTime: "2026-01-01T00:00:00.000Z",
    buildTimestamp: 1767225600000,
  },
}));

import { GET } from "./+server";

function makeRequest() {
  return new Request("http://localhost/api/version");
}

describe("GET /api/version", () => {
  it("returns build info as JSON", async () => {
    const response = await GET(makeRequest() as never);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      version: "1.2.3",
      commit: "abc1234",
      branch: "main",
      buildTime: "2026-01-01T00:00:00.000Z",
      buildTimestamp: 1767225600000,
    });
  });

  it("returns Content-Type application/json", async () => {
    const response = await GET(makeRequest() as never);

    expect(response.headers.get("content-type")).toBe("application/json");
  });
});
