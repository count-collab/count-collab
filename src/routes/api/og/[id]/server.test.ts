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
});
