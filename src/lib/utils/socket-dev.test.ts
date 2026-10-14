import { afterEach, describe, expect, it } from "vitest";
import { getIO } from "./socket-dev";

describe("getIO", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__socketIO;
  });

  it("returns null when Socket.IO is not initialized", () => {
    expect(getIO()).toBeNull();
  });

  it("returns the instance registered on globalThis", () => {
    const fake = {} as never;
    globalThis.__socketIO = fake;

    expect(getIO()).toBe(fake);
  });
});
