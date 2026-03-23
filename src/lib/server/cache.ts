import { LRUCache } from "lru-cache";

export function createCache<T extends object>(opts: {
  ttlMs: number;
  maxSize: number;
}): LRUCache<string, T> {
  return new LRUCache<string, T>({
    max: opts.maxSize,
    ttl: opts.ttlMs,
  });
}
