import type { LRUCache } from "lru-cache";
import { beforeEach, describe, expect, it } from "vitest";
import { createCache } from "./cache";

describe("createCache", () => {
  let cache: LRUCache<string, string[]>;

  beforeEach(() => {
    cache = createCache<string[]>({ ttlMs: 1000, maxSize: 100 });
  });

  it("should return undefined for missing keys", () => {
    expect(cache.get("missing")).toBeUndefined();
  });

  it("should store and retrieve values", () => {
    cache.set("a", ["hello"]);
    expect(cache.get("a")).toEqual(["hello"]);
  });

  it("should expire entries after ttlMs", async () => {
    const shortCache = createCache<string[]>({ ttlMs: 50, maxSize: 100 });
    shortCache.set("a", ["hello"]);
    expect(shortCache.get("a")).toEqual(["hello"]);

    await new Promise((r) => setTimeout(r, 60));
    expect(shortCache.get("a")).toBeUndefined();
  });

  it("should delete entries", () => {
    cache.set("a", ["hello"]);
    expect(cache.delete("a")).toBe(true);
    expect(cache.get("a")).toBeUndefined();
  });

  it("should return false when deleting a missing key", () => {
    expect(cache.delete("missing")).toBe(false);
  });

  it("should clear all entries", () => {
    cache.set("a", ["1"]);
    cache.set("b", ["2"]);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });

  it("should evict least-recently-used entry when maxSize is exceeded", () => {
    const small = createCache<string[]>({ ttlMs: 10_000, maxSize: 2 });
    small.set("a", ["1"]);
    small.set("b", ["2"]);
    small.set("c", ["3"]);

    expect(small.get("a")).toBeUndefined();
    expect(small.get("b")).toEqual(["2"]);
    expect(small.get("c")).toEqual(["3"]);
  });
});
