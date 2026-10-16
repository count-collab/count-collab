import { afterEach, describe, expect, it } from "vitest";
import { lockBodyScroll } from "./scroll-lock";

describe("lockBodyScroll", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("hides body overflow and restores the previous value on unlock", () => {
    document.body.style.overflow = "auto";
    const unlock = lockBodyScroll();
    expect(document.body.style.overflow).toBe("hidden");

    unlock();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("keeps the body locked until every nested lock is released, in any order", () => {
    const unlockOuter = lockBodyScroll();
    const unlockInner = lockBodyScroll();

    unlockOuter();
    expect(document.body.style.overflow).toBe("hidden");

    unlockInner();
    expect(document.body.style.overflow).toBe("");
  });

  it("ignores repeated unlock calls", () => {
    const unlockA = lockBodyScroll();
    const unlockB = lockBodyScroll();

    unlockA();
    unlockA();
    expect(document.body.style.overflow).toBe("hidden");

    unlockB();
    expect(document.body.style.overflow).toBe("");
  });
});
