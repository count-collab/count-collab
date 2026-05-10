<script lang="ts">
  import { Chart, registerables } from "chart.js";
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";

  if (browser) {
    Chart.register(...registerables);
  }

  let {
    metric,
    title,
    timeframe,
    selectedUserId,
    selectedCounterId,
    onUserSelect,
    onCounterSelect,
  }: {
    metric: string;
    title: string;
    timeframe: string;
    selectedUserId: string | null;
    selectedCounterId: string | null;
    onUserSelect: (userId: string | null) => void;
    onCounterSelect: (counterId: string | null) => void;
  } = $props();

  interface TimeSeriesPoint {
    timestamp: string;
    count: number;
  }

  interface TopUser {
    userId: string;
    name: string | null;
    username: string | null;
    image: string | null;
    count: number;
  }

  interface TopCounter {
    counterId: string;
    title: string;
    count: number;
  }

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: Chart | undefined;
  let loading = $state(false);
  let timeSeries = $state<TimeSeriesPoint[]>([]);
  let topUsers = $state<TopUser[]>([]);
  let topCounters = $state<TopCounter[]>([]);
  let granularity = $state<"hourly" | "daily">("daily");
  let queryDurationMs = $state<number | null>(null);

  async function fetchData() {
    loading = true;
    try {
      const params = new URLSearchParams({ metric, timeframe });
      if (selectedUserId) params.set("userId", selectedUserId);
      if (selectedCounterId) params.set("counterId", selectedCounterId);
      const res = await fetch(`/api/admin/statistics?${params}`);
      if (!res.ok) {
        timeSeries = [];
        topUsers = [];
        topCounters = [];
        queryDurationMs = null;
        return;
      }
      const data = await res.json();
      timeSeries = data.timeSeries;
      topUsers = data.topUsers;
      topCounters = data.topCounters ?? [];
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
      granularity === "hourly" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    // Build a lookup map from existing data (DB returns UTC-truncated timestamps)
    const dataMap = new Map<string, number>();
    for (const point of data) {
      const key = new Date(point.timestamp).getTime().toString();
      dataMap.set(key, point.count);
    }

    // Generate all buckets aligned to UTC (matching DB's date_trunc behavior)
    const now = new Date();
    const start = new Date(now.getTime() - ms);

    // Truncate start to the beginning of the bucket in UTC
    if (granularity === "hourly") {
      start.setUTCMinutes(0, 0, 0);
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
      ? "rgba(148, 163, 184, 0.1)"
      : "rgba(148, 163, 184, 0.2)";
    const textColor = isDark ? "#94a3b8" : "#64748b";
    const lineColor = isDark ? "#60a5fa" : "#3b82f6";
    const fillColor = isDark
      ? "rgba(96, 165, 250, 0.1)"
      : "rgba(59, 130, 246, 0.08)";

    const filledSeries = fillTimeSeries(timeSeries);

    const labels = filledSeries.map((p) => {
      const d = new Date(p.timestamp);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yyyy = d.getFullYear();
      if (granularity === "hourly") {
        const hh = String(d.getHours()).padStart(2, "0");
        return `${mm}/${dd}/${yyyy} ${hh}:00`;
      }
      return `${mm}/${dd}/${yyyy}`;
    });

    const counts = filledSeries.map((p) => p.count);

    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: title,
            data: counts,
            borderColor: lineColor,
            backgroundColor: fillColor,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: filledSeries.length > 60 ? 0 : 3,
            pointHoverRadius: 5,
          },
        ],
      },
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
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            titleColor: isDark ? "#e2e8f0" : "#1e293b",
            bodyColor: isDark ? "#cbd5e1" : "#475569",
            borderColor: isDark ? "#334155" : "#e2e8f0",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, maxTicksLimit: 10 },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, precision: 0 },
          },
        },
      },
    });
  }

  $effect(() => {
    // Track dependencies
    metric;
    timeframe;
    selectedUserId;
    selectedCounterId;

    if (browser) {
      fetchData();
    }
  });

  $effect(() => {
    // Re-render chart when data changes
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
  <div class="mb-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
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
    {#if selectedUserId || selectedCounterId}
      <div class="flex items-center gap-2">
        {#if selectedCounterId}
          <button
            type="button"
            onclick={() => onCounterSelect(null)}
            class="flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <ion-icon name="close-outline" style="font-size: 14px;"></ion-icon>
            Clear counter
          </button>
        {/if}
        {#if selectedUserId}
          <button
            type="button"
            onclick={() => onUserSelect(null)}
            class="flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40"
          >
            <ion-icon name="close-outline" style="font-size: 14px;"></ion-icon>
            Clear user
          </button>
        {/if}
      </div>
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
    {:else if timeSeries.length === 0}
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

  {#if topUsers.length > 0 || topCounters.length > 0}
    <div
      class="mt-5 grid gap-5 border-t border-slate-100 dark:border-slate-700 pt-4"
      class:grid-cols-2={topUsers.length > 0 && topCounters.length > 0}
    >
      {#if topCounters.length > 0}
        <div>
          <h3
            class="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400"
          >
            Top Counters
          </h3>
          <div class="space-y-1">
            {#each topCounters as counter (counter.counterId)}
              <button
                type="button"
                onclick={() =>
                  onCounterSelect(
                    selectedCounterId === counter.counterId
                      ? null
                      : counter.counterId,
                  )}
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors
                  {selectedCounterId === counter.counterId
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}"
              >
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600"
                >
                  <ion-icon
                    name="trending-up-outline"
                    class="text-slate-500 dark:text-slate-300"
                    style="font-size: 14px;"
                  ></ion-icon>
                </div>
                <p
                  class="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  {counter.title}
                </p>
                <span
                  class="tabular-nums text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  {counter.count.toLocaleString()}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if topUsers.length > 0}
        <div>
          <h3
            class="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400"
          >
            Top Users
          </h3>
          <div class="space-y-1">
            {#each topUsers as user (user.userId)}
              <button
                type="button"
                onclick={() =>
                  onUserSelect(
                    selectedUserId === user.userId ? null : user.userId,
                  )}
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors
                  {selectedUserId === user.userId
                  ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}"
              >
                {#if user.image}
                  <img
                    src={user.image}
                    alt=""
                    class="h-8 w-8 rounded-full object-cover"
                  />
                {:else}
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600"
                  >
                    <ion-icon
                      name="person-outline"
                      class="text-slate-500 dark:text-slate-300"
                      style="font-size: 14px;"
                    ></ion-icon>
                  </div>
                {/if}
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    {user.name || user.username || "Unknown"}
                  </p>
                  {#if user.username && user.name}
                    <p
                      class="truncate text-xs text-slate-500 dark:text-slate-400"
                    >
                      @{user.username}
                    </p>
                  {/if}
                </div>
                <span
                  class="tabular-nums text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  {user.count.toLocaleString()}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
