import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import PersonalStats from "./PersonalStats.svelte";

const { MockChart } = vi.hoisted(() => ({
  MockChart: class MockChart {
    static register: (...args: unknown[]) => void = vi.fn();
    destroy: () => void = vi.fn();
    update: () => void = vi.fn();
  },
}));

vi.mock("chart.js", () => ({
  Chart: MockChart,
  registerables: [],
}));

const baseAnonStats = {
  thisWeek: 3,
  thisMonth: 10,
  thisQuarter: 25,
  thisYear: 80,
  total: 120,
  dailyBreakdown: [],
};

const sampleUserStats = {
  totals: {
    thisWeek: 5,
    thisMonth: 20,
    thisQuarter: 60,
    thisYear: 200,
    total: 500,
  },
  dailyBreakdown: [
    { date: "2026-03-30", actions: 10 },
    { date: "2026-04-06", actions: 15 },
    { date: "2026-04-13", actions: 8 },
  ],
};

describe("PersonalStats", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders anonymous stats section", () => {
    render(PersonalStats, {
      props: { userStats: null, anonymousStats: baseAnonStats },
    });

    expect(screen.getByText("Anonymous")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("120 total actions")).toBeTruthy();
  });

  it("renders user stats section when userStats is provided", () => {
    render(PersonalStats, {
      props: { userStats: sampleUserStats, anonymousStats: baseAnonStats },
    });

    expect(screen.getByText("Your Stats")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("500 total actions")).toBeTruthy();
  });

  it("does not render user stats section when userStats is null", () => {
    const { container } = render(PersonalStats, {
      props: { userStats: null, anonymousStats: baseAnonStats },
    });

    const yourStatsEls = Array.from(container.querySelectorAll("h3")).filter(
      (h) => h.textContent === "Your Stats",
    );
    expect(yourStatsEls.length).toBe(0);
  });

  it("renders all four time period pills for anonymous", () => {
    const { container } = render(PersonalStats, {
      props: { userStats: null, anonymousStats: baseAnonStats },
    });

    const monthPills = container.querySelectorAll(
      ".grid.grid-cols-2 .rounded-lg p.uppercase",
    );
    const labels = Array.from(monthPills).map((el) => el.textContent);
    expect(labels.some((l) => l?.startsWith("This Week"))).toBe(true);
    expect(labels.some((l) => l?.startsWith("This Month"))).toBe(true);
    expect(labels.some((l) => l?.startsWith("This Quarter"))).toBe(true);
    expect(labels.some((l) => l?.startsWith("This Year"))).toBe(true);
  });

  it("renders weekly breakdown canvas when user has weekly data", () => {
    const { container } = render(PersonalStats, {
      props: { userStats: sampleUserStats, anonymousStats: baseAnonStats },
    });

    const canvases = container.querySelectorAll("canvas");
    expect(canvases.length).toBe(1);
  });

  it("does not render canvas when user has no weekly breakdown", () => {
    const { container } = render(PersonalStats, {
      props: {
        userStats: {
          totals: sampleUserStats.totals,
          dailyBreakdown: [],
        },
        anonymousStats: baseAnonStats,
      },
    });

    const canvases = container.querySelectorAll("canvas");
    expect(canvases.length).toBe(0);
  });
});
