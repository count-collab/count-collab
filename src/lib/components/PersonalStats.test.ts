import { render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import PersonalStats from "./PersonalStats.svelte";

const { MockChart, chartCreated } = vi.hoisted(() => ({
  chartCreated: vi.fn(),
  MockChart: class MockChart {
    static register: (...args: unknown[]) => void = vi.fn();
    destroy: () => void = vi.fn();
    update: () => void = vi.fn();

    constructor(_canvas: HTMLCanvasElement, config: unknown) {
      chartCreated(config);
    }
  },
}));

vi.mock("chart.js", () => ({
  Chart: MockChart,
  registerables: [],
}));

const baseCounterStats = {
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

  it("renders all counter activity with an inclusive label", () => {
    render(PersonalStats, {
      props: { userStats: null, counterStats: baseCounterStats },
    });

    expect(screen.getByText("All Activity")).toBeTruthy();
    expect(screen.getByText("Includes signed-in users and guests")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("120 total actions")).toBeTruthy();
  });

  it("renders user stats section when userStats is provided", () => {
    render(PersonalStats, {
      props: { userStats: sampleUserStats, counterStats: baseCounterStats },
    });

    expect(screen.getByText("Your Stats")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("500 total actions")).toBeTruthy();
  });

  it("does not render user stats section when userStats is null", () => {
    const { container } = render(PersonalStats, {
      props: { userStats: null, counterStats: baseCounterStats },
    });

    const yourStatsEls = Array.from(container.querySelectorAll("h3")).filter(
      (h) => h.textContent === "Your Stats",
    );
    expect(yourStatsEls.length).toBe(0);
  });

  it("renders all four time period pills for all activity", () => {
    const { container } = render(PersonalStats, {
      props: { userStats: null, counterStats: baseCounterStats },
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
      props: { userStats: sampleUserStats, counterStats: baseCounterStats },
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
        counterStats: baseCounterStats,
      },
    });

    const canvases = container.querySelectorAll("canvas");
    expect(canvases.length).toBe(0);
  });

  it("renders the all-activity chart when there are multiple active days", () => {
    const { container } = render(PersonalStats, {
      props: {
        userStats: null,
        counterStats: {
          ...baseCounterStats,
          dailyBreakdown: [
            { date: "2026-04-06", actions: 2 },
            { date: "2026-04-07", actions: 3 },
          ],
        },
      },
    });

    expect(container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("uses DD.MM dates in both chart tooltips", async () => {
    const breakdown = [
      { date: "2026-10-17T12:00:00", actions: 23 },
      { date: "2026-04-06T12:00:00", actions: 3 },
    ];
    render(PersonalStats, {
      props: {
        userStats: { ...sampleUserStats, dailyBreakdown: breakdown },
        counterStats: { ...baseCounterStats, dailyBreakdown: breakdown },
      },
    });

    await waitFor(() => {
      expect(chartCreated).toHaveBeenCalledTimes(2);
    });
    for (const [config] of chartCreated.mock.calls) {
      expect(config).toMatchObject({
        data: { labels: ["17.10", "06.04"] },
      });
    }
  });
});
