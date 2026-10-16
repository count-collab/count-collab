import { describe, expect, it, vi } from "vitest";

const { mockGetCounter } = vi.hoisted(() => ({
  mockGetCounter: vi.fn(),
}));

vi.mock("$lib/server/counters", () => ({
  getCounter: mockGetCounter,
}));

vi.mock("$lib/utils/validation", () => ({
  counterIdSchema: {
    safeParse: (val: string) => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(val)
        ? { success: true, data: val }
        : { success: false };
    },
  },
}));

vi.mock("satori", () => ({
  default: vi.fn(async () => "<svg></svg>"),
}));

vi.mock("@resvg/resvg-js", () => {
  class MockResvg {
    render() {
      return {
        asPng: () => new Uint8Array([137, 80, 78, 71]),
      };
    }
  }
  return { Resvg: MockResvg };
});

import satori from "satori";
import { GET } from "./+server";

function makeEvent(id: string) {
  return {
    params: { id },
  } as any;
}

describe("GET /api/og/[id]", () => {
  it("returns 400 for invalid counter ID", async () => {
    await expect(GET(makeEvent("not-a-uuid"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 404 when counter does not exist", async () => {
    mockGetCounter.mockResolvedValue(null);

    await expect(
      GET(makeEvent("11111111-1111-1111-1111-111111111111")),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns 404 for private counters", async () => {
    mockGetCounter.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      title: "Private Counter",
      description: null,
      count: 42,
      visibilityMode: "private",
    });

    await expect(
      GET(makeEvent("11111111-1111-1111-1111-111111111111")),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns a PNG image for a public counter", async () => {
    mockGetCounter.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      title: "Test Counter",
      description: "A test description",
      count: 42,
      visibilityMode: "public",
    });

    const response = await GET(
      makeEvent("11111111-1111-1111-1111-111111111111"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("max-age=60");
  });

  it("handles counters with large counts", async () => {
    mockGetCounter.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      title: "Popular Counter",
      description: null,
      count: 1_500_000,
      visibilityMode: "public",
    });

    const response = await GET(
      makeEvent("22222222-2222-2222-2222-222222222222"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("handles counters with long titles", async () => {
    mockGetCounter.mockResolvedValue({
      id: "33333333-3333-3333-3333-333333333333",
      title: "A".repeat(100),
      description: "B".repeat(200),
      count: 7,
      visibilityMode: "public",
    });

    const response = await GET(
      makeEvent("33333333-3333-3333-3333-333333333333"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("serves repeat requests from the cache until the counter changes", async () => {
    const id = "44444444-4444-4444-4444-444444444444";
    const base = {
      id,
      title: "Cached",
      description: null,
      count: 5,
      visibilityMode: "public",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    vi.mocked(satori).mockClear();
    mockGetCounter.mockResolvedValue(base);

    const first = await GET(makeEvent(id));
    const second = await GET(makeEvent(id));
    expect(satori).toHaveBeenCalledTimes(1);
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(
      new Uint8Array(await first.arrayBuffer()),
    );
    expect(second.headers.get("Content-Type")).toBe("image/png");

    mockGetCounter.mockResolvedValue({
      ...base,
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    await GET(makeEvent(id));
    expect(satori).toHaveBeenCalledTimes(2);
  });

  it("never serves a cached image for a counter that became private", async () => {
    const id = "55555555-5555-5555-5555-555555555555";
    const counter = {
      id,
      title: "Was public",
      description: null,
      count: 1,
      visibilityMode: "public",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    mockGetCounter.mockResolvedValue(counter);
    await GET(makeEvent(id));

    mockGetCounter.mockResolvedValue({ ...counter, visibilityMode: "private" });
    await expect(GET(makeEvent(id))).rejects.toMatchObject({ status: 404 });
  });
});
