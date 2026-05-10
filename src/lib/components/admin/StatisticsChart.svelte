<script lang="ts">
  import { Chart, registerables } from "chart.js";
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";

  if (browser) {
    Chart.register(...registerables);
  }

  let {
    filters = {},
    timeframe,
  }: {
    filters: Record<string, string>;
    timeframe: string;
  } = $props();

  interface TimeSeriesPoint {
    timestamp: string;
    count: number;
  }

  const EVENT_TYPE_COLORS: Record<string, string> = {
    counter_action: "#3b82f6",
    counter_created: "#10b981",
    counter_deleted: "#ef4444",
    user_registered: "#8b5cf6",
    user_deleted: "#f97316",
    goal_created: "#06b6d4",
    goal_reached: "#eab308",
    goal_deleted: "#a855f7",
    dashboard_created: "#14b8a6",
    dashboard_deleted: "#f43f5e",
    invitation_sent: "#6366f1",
    invitation_accepted: "#22c55e",
    invitation_deleted: "#fb923c",
    follower_added: "#0ea5e9",
    follower_removed: "#e879f9",
    member_removed: "#f87171",
  };

  const FALLBACK_COLORS = [
    "#64748b",
    "#a78bfa",
    "#34d399",
    "#fbbf24",
    "#f472b6",
    "#38bdf8",
    "#fb7185",
    "#4ade80",
  ];

  function colorFor(eventType: string, index: number): string {
    return (
      EVENT_TYPE_COLORS[eventType] ??
      FALLBACK_COLORS[index % FALLBACK_COLORS.length]
    );
  }

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: Chart | undefined;
  let loading = $state(false);
  let timeSeries = $state<Record<string, TimeSeriesPoint[]>>({});
  let granularity = $state<"hourly" | "6h" | "daily">("daily");
  let queryDurationMs = $state<number | null>(null);
  let hasData = $derived(Object.keys(timeSeries).length > 0);

  async function fetchData() {
    loading = true;
    try {
      const params = new URLSearchParams({ timeframe });
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(`filter.${key}`, value);
      }
      const res = await fetch(`/api/admin/statistics?${params}`);
      if (!res.ok) {
        timeSeries = {};
        queryDurationMs = null;
        return;
      }
      const data = await res.json();
      timeSeries = data.timeSeries;
      granularity = data.granularity;
      queryDurationMs = data.queryDurationMs ?? null;
    } finally {
      loading = false;
    }
  }

  const TIMEFRAME_MS: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };

  function fillTimeSeries(
    data: TimeSeriesPoint[],
  ): { timestamp: string; count: number }[] {
    const ms = TIMEFRAME_MS[timeframe] ?? 30 * 24 * 60 * 60 * 1000;
    const step =
      granularity === "hourly"
        ? 60 * 60 * 1000
        : granularity === "6h"
          ? 6 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

    const dataMap = new Map<string, number>();
    for (const point of data) {
      const key = new Date(point.timestamp).getTime().toString();
      dataMap.set(key, point.count);
    }

    const now = new Date();
    const start = new Date(now.getTime() - ms);

    if (granularity === "hourly") {
      start.setUTCMinutes(0, 0, 0);
    } else if (granularity === "6h") {
      const h = start.getUTCHours();
      start.setUTCHours(h - (h % 6), 0, 0, 0);
    } else {
      start.setUTCHours(0, 0, 0, 0);
    }

    const result: { timestamp: string; count: number }[] = [];
    const current = new Date(start);

    while (current <= now) {
      const key = current.getTime().toString();
      result.push({
        timestamp: current.toISOString(),
        count: dataMap.get(key) ?? 0,
      });
      current.setTime(current.getTime() + step);
    }

    return result;
  }

  function renderChart() {
    if (!browser || !canvas) return;

    if (chart) {
      chart.destroy();
      chart = undefined;
    }

    const isDark = document.documentElement.classList.contains("dark");
    const gridColor = isDark
      ? "rgba(148, 163, 184, 0.06)"
      : "rgba(148, 163, 184, 0.15)";
    const textColor = isDark ? "#64748b" : "#94a3b8";

    const eventTypes = Object.keys(timeSeries);
    const isStacked = eventTypes.length > 1;

    // Use first event type's filled series for labels
    const firstFilled = fillTimeSeries(timeSeries[eventTypes[0]] ?? []);
    const labels = firstFilled.map((p) => {
      const d = new Date(p.timestamp);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yyyy = d.getFullYear();
      if (granularity === "hourly" || granularity === "6h") {
        const hh = String(d.getHours()).padStart(2, "0");
        return `${mm}/${dd}/${yyyy} ${hh}:00`;
      }
      return `${mm}/${dd}/${yyyy}`;
    });

    const datasets = eventTypes.map((eventType, i) => {
      const filled = fillTimeSeries(timeSeries[eventType] ?? []);
      const color = colorFor(eventType, i);
      return {
        label: eventType
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        data: filled.map((p) => p.count),
        backgroundColor: `${color}cc`,
        hoverBackgroundColor: color,
        borderRadius: 0,
        borderSkipped: false as const,
        borderWidth: 0,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      };
    });

    chart = new Chart(canvas, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark
              ? "rgba(15, 23, 42, 0.95)"
              : "rgba(255, 255, 255, 0.95)",
            titleColor: isDark ? "#f1f5f9" : "#0f172a",
            bodyColor: isDark ? "#94a3b8" : "#475569",
            borderColor: isDark
              ? "rgba(51, 65, 85, 0.5)"
              : "rgba(226, 232, 240, 0.8)",
            borderWidth: 1,
            cornerRadius: 10,
            padding: 12,
            boxPadding: 6,
            titleFont: { size: 12, weight: "bold" as const },
            bodyFont: { size: 12 },
            usePointStyle: true,
            filter: (item) => item.raw !== 0,
          },
        },
        scales: {
          x: {
            stacked: isStacked,
            border: { display: false },
            grid: { display: false },
            ticks: {
              color: textColor,
              maxTicksLimit: 8,
              font: { size: 11 },
            },
          },
          y: {
            stacked: isStacked,
            beginAtZero: true,
            border: { display: false },
            grid: {
              color: gridColor,
              drawTicks: false,
            },
            ticks: {
              color: textColor,
              precision: 0,
              padding: 8,
              font: { size: 11 },
            },
          },
        },
      },
    });
  }

  $effect(() => {
    filters;
    timeframe;

    if (browser) {
      fetchData();
    }
  });

  $effect(() => {
    timeSeries;
    if (browser && canvas) {
      renderChart();
    }
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
      chart = undefined;
    }
  });
</script>

<div
  class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
>
  <div class="mb-4 flex items-center gap-3">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
      Event Activity
    </h2>
    {#if queryDurationMs !== null}
      <span
        class="rounded-md px-2 py-0.5 text-xs font-mono tabular-nums {queryDurationMs >
        500
          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          : queryDurationMs > 100
            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}"
        title="Query duration"
      >
        {queryDurationMs}ms
      </span>
    {/if}
  </div>

  <div class="relative h-64">
    {#if loading}
      <div
        class="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-50/80 dark:bg-slate-900/50"
      >
        <div
          class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
        ></div>
      </div>
    {:else if !hasData}
      <div
        class="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700"
      >
        <p class="text-sm text-slate-400 dark:text-slate-500">
          No data available
        </p>
      </div>
    {:else}
      <canvas bind:this={canvas}></canvas>
    {/if}
  </div>
</div>
