import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("$lib/server/counters", () => ({
  listPublicCounters: vi.fn(),
}));

import { listPublicCounters } from "$lib/server/counters";
import { load } from "./+page.server";

const mockListPublicCounters = listPublicCounters as Mock;

function makeLoadArgs(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/counters");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return {
    depends: vi.fn(),
    url,
  } as unknown as Parameters<typeof load>[0];
}

async function callLoad(params: Record<string, string> = {}) {
  const args = makeLoadArgs(params);
  const result = (await load(args)) as {
    query: string;
    sort: string;
    counters: unknown[];
    page: number;
    totalPages: number;
  };
  return { result, args };
}

describe("GET /counters (load)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPublicCounters.mockResolvedValue({ items: [], total: 0 });
  });

  describe("sort parameter", () => {
    it("defaults to 'popular' when sort param is missing", async () => {
      const { result } = await callLoad();

      expect(result.sort).toBe("popular");
      expect(mockListPublicCounters).toHaveBeenCalledWith(16, "", 0, "popular");
    });

    it("accepts 'popular' as a valid sort value", async () => {
      const { result } = await callLoad({ sort: "popular" });

      expect(result.sort).toBe("popular");
      expect(mockListPublicCounters).toHaveBeenCalledWith(16, "", 0, "popular");
    });

    it("accepts 'newest' as a valid sort value", async () => {
      const { result } = await callLoad({ sort: "newest" });

      expect(result.sort).toBe("newest");
      expect(mockListPublicCounters).toHaveBeenCalledWith(16, "", 0, "newest");
    });

    it("accepts 'updated' as a valid sort value", async () => {
      const { result } = await callLoad({ sort: "updated" });

      expect(result.sort).toBe("updated");
      expect(mockListPublicCounters).toHaveBeenCalledWith(16, "", 0, "updated");
    });

    it("defaults to 'popular' for invalid sort values", async () => {
      const { result } = await callLoad({ sort: "invalid" });

      expect(result.sort).toBe("popular");
      expect(mockListPublicCounters).toHaveBeenCalledWith(16, "", 0, "popular");
    });

    it("defaults to 'popular' for empty sort param", async () => {
      const { result } = await callLoad({ sort: "" });

      expect(result.sort).toBe("popular");
      expect(mockListPublicCounters).toHaveBeenCalledWith(16, "", 0, "popular");
    });
  });

  describe("sort combined with other params", () => {
    it("preserves sort alongside search query", async () => {
      const { result } = await callLoad({ q: "test query", sort: "newest" });

      expect(result.sort).toBe("newest");
      expect(result.query).toBe("test query");
      expect(mockListPublicCounters).toHaveBeenCalledWith(
        16,
        "test query",
        0,
        "newest",
      );
    });

    it("preserves sort alongside pagination", async () => {
      const { result } = await callLoad({ page: "3", sort: "updated" });

      expect(result.sort).toBe("updated");
      expect(result.page).toBe(3);
      expect(mockListPublicCounters).toHaveBeenCalledWith(
        16,
        "",
        32,
        "updated",
      );
    });

    it("preserves sort with both query and pagination", async () => {
      const { result } = await callLoad({
        q: "hello",
        page: "2",
        sort: "newest",
      });

      expect(result.sort).toBe("newest");
      expect(result.query).toBe("hello");
      expect(result.page).toBe(2);
      expect(mockListPublicCounters).toHaveBeenCalledWith(
        16,
        "hello",
        16,
        "newest",
      );
    });
  });

  describe("query parameter", () => {
    it("trims and caps query to 80 characters", async () => {
      const longQuery = "a".repeat(100);
      await callLoad({ q: `  ${longQuery}  ` });

      expect(mockListPublicCounters).toHaveBeenCalledWith(
        16,
        "a".repeat(80),
        0,
        "popular",
      );
    });

    it("defaults to empty string when query is missing", async () => {
      const { result } = await callLoad();

      expect(result.query).toBe("");
    });
  });

  describe("pagination", () => {
    it("defaults page to 1 when missing", async () => {
      const { result } = await callLoad();

      expect(result.page).toBe(1);
      expect(mockListPublicCounters).toHaveBeenCalledWith(16, "", 0, "popular");
    });

    it("clamps page to minimum of 1", async () => {
      const { result } = await callLoad({ page: "-5" });

      expect(result.page).toBe(1);
    });

    it("treats non-numeric page as 1", async () => {
      const { result } = await callLoad({ page: "abc" });

      expect(result.page).toBe(1);
    });

    it("computes offset from page number", async () => {
      await callLoad({ page: "3" });

      expect(mockListPublicCounters).toHaveBeenCalledWith(
        16,
        "",
        32,
        "popular",
      );
    });
  });

  describe("response shape", () => {
    it("returns counters, pagination, query, and sort", async () => {
      const items = [{ id: "1", title: "Counter 1" }];
      mockListPublicCounters.mockResolvedValue({ items, total: 1 });

      const { result } = await callLoad({ sort: "newest" });

      expect(result).toEqual({
        query: "",
        sort: "newest",
        counters: items,
        total: 1,
        page: 1,
        totalPages: 1,
      });
    });

    it("computes totalPages correctly", async () => {
      mockListPublicCounters.mockResolvedValue({ items: [], total: 33 });

      const { result } = await callLoad();

      expect(result.totalPages).toBe(3);
    });

    it("returns totalPages of 1 when there are no results", async () => {
      mockListPublicCounters.mockResolvedValue({ items: [], total: 0 });

      const { result } = await callLoad();

      expect(result.totalPages).toBe(1);
    });
  });

  it("registers counters:list dependency", async () => {
    const { args } = await callLoad();

    expect(args.depends).toHaveBeenCalledWith("counters:list");
  });
});
