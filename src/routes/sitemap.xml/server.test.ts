import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/counters", () => ({
  listPublicCounterSitemapEntries: vi.fn(),
}));

vi.mock("$lib/server/build-info.generated", () => ({
  buildInfo: { buildTime: "2025-01-01T00:00:00Z" },
}));

vi.mock("$lib/counter", async () => {
  const actual =
    await vi.importActual<typeof import("$lib/counter")>("$lib/counter");
  return { slugify: actual.slugify };
});

const mockEvent = { url: new URL("https://example.com/sitemap.xml") } as never;

describe("GET /sitemap.xml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid XML with correct headers", async () => {
    const { listPublicCounterSitemapEntries } =
      await import("$lib/server/counters");
    vi.mocked(listPublicCounterSitemapEntries).mockResolvedValue([]);

    const { GET } = await import("./+server");
    const response = await GET(mockEvent);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/xml; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");

    const body = await response.text();
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain("<urlset");
  });

  it("includes static entries for / and /counters with buildTime lastmod", async () => {
    const { listPublicCounterSitemapEntries } =
      await import("$lib/server/counters");
    vi.mocked(listPublicCounterSitemapEntries).mockResolvedValue([]);

    const { GET } = await import("./+server");
    const response = await GET(mockEvent);
    const body = await response.text();

    expect(body).toContain("<loc>https://example.com/</loc>");
    expect(body).toContain("<lastmod>2025-01-01T00:00:00Z</lastmod>");
    expect(body).toContain("<loc>https://example.com/counters</loc>");
  });

  it("includes dynamic counter entries with lastmod", async () => {
    const { listPublicCounterSitemapEntries } =
      await import("$lib/server/counters");
    vi.mocked(listPublicCounterSitemapEntries).mockResolvedValue([
      {
        id: "abc-123",
        title: "Test Counter",
        updatedAt: new Date("2025-06-15T10:00:00.000Z"),
      },
      { id: "def-456", title: "Another One", updatedAt: null },
    ]);

    const { GET } = await import("./+server");
    const response = await GET(mockEvent);
    const body = await response.text();

    expect(body).toContain(
      "<loc>https://example.com/c/abc-123/test-counter</loc>",
    );
    expect(body).toContain("<lastmod>2025-06-15T10:00:00Z</lastmod>");
    expect(body).toContain(
      "<loc>https://example.com/c/def-456/another-one</loc>",
    );
  });

  it("omits lastmod for counters with null updatedAt", async () => {
    const { listPublicCounterSitemapEntries } =
      await import("$lib/server/counters");
    vi.mocked(listPublicCounterSitemapEntries).mockResolvedValue([
      { id: "no-date", title: "No Date Counter", updatedAt: null },
    ]);

    const { GET } = await import("./+server");
    const response = await GET(mockEvent);
    const body = await response.text();

    expect(body).toContain(
      "<loc>https://example.com/c/no-date/no-date-counter</loc>",
    );
    const counterUrlMatch = body.match(
      /<url><loc>https:\/\/example\.com\/c\/no-date\/no-date-counter<\/loc>([^<]*)<\/url>/,
    );
    expect(counterUrlMatch).toBeTruthy();
    expect(counterUrlMatch?.[1]).not.toContain("<lastmod>");
  });

  it("uses url.origin for all URLs", async () => {
    const { listPublicCounterSitemapEntries } =
      await import("$lib/server/counters");
    vi.mocked(listPublicCounterSitemapEntries).mockResolvedValue([
      {
        id: "test-1",
        title: "Test One",
        updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      },
    ]);

    const customEvent = {
      url: new URL("https://myapp.io/sitemap.xml"),
    } as never;
    const { GET } = await import("./+server");
    const response = await GET(customEvent);
    const body = await response.text();

    expect(body).toContain("<loc>https://myapp.io/</loc>");
    expect(body).toContain("<loc>https://myapp.io/counters</loc>");
    expect(body).toContain("<loc>https://myapp.io/c/test-1/test-one</loc>");
    expect(body).not.toContain("https://example.com");
  });
});
