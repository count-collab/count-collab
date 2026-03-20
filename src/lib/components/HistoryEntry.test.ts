import { render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import HistoryEntry from "./HistoryEntry.svelte";

describe("HistoryEntry", () => {
  function getText(props: {
    username: string | null;
    newValue: number;
    changedAt: Date;
  }) {
    const { container } = render(HistoryEntry, { props });
    return container.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }

  it("shows username when provided", () => {
    const text = getText({
      username: "alice",
      newValue: 2,
      changedAt: new Date(),
    });
    expect(text).toContain("alice");
  });

  it('shows "Someone" when username is null', () => {
    const text = getText({
      username: null,
      newValue: 2,
      changedAt: new Date(),
    });
    expect(text).toContain("Someone");
  });

  it("shows the new value", () => {
    const text = getText({
      username: "alice",
      newValue: 42,
      changedAt: new Date(),
    });
    expect(text).toContain("42");
  });

  it("shows time only (HH:MM) for today's entries", () => {
    const now = new Date();
    now.setHours(16, 20, 8);
    const text = getText({ username: "alice", newValue: 2, changedAt: now });
    expect(text).toContain("@ 16:20");
    // Should NOT contain a date part for today
    const dateStr = `${now.getDate()}.${now.getMonth() + 1}.`;
    expect(text).not.toContain(dateStr);
  });

  it("shows time + date for non-today entries", () => {
    // Use a fixed fake "now" so the test is deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 19, 14, 0, 0));

    const yesterday = new Date(2026, 2, 18, 9, 5, 0);
    const text = getText({
      username: "bob",
      newValue: 5,
      changedAt: yesterday,
    });
    expect(text).toContain("@ 09:05 18.3.26");

    vi.useRealTimers();
  });

  it("pads hours and minutes with leading zeros", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 19, 14, 0, 0));

    const early = new Date(2026, 0, 1, 3, 7, 0);
    const text = getText({ username: "alice", newValue: 10, changedAt: early });
    expect(text).toContain("03:07");

    vi.useRealTimers();
  });

  it("handles midnight for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 19, 14, 0, 0));

    const midnight = new Date(2026, 2, 19, 0, 0, 0);
    const text = getText({ username: null, newValue: 1, changedAt: midnight });
    expect(text).toContain("Someone");
    expect(text).toContain("@ 00:00");

    vi.useRealTimers();
  });

  it("handles entries from different years", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 19, 14, 0, 0));

    const oldEntry = new Date(2025, 11, 31, 23, 59, 0);
    const text = getText({
      username: "alice",
      newValue: 100,
      changedAt: oldEntry,
    });
    expect(text).toContain("23:59 31.12.25");

    vi.useRealTimers();
  });
});
