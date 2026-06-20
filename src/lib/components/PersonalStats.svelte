<script lang="ts">
  import { Chart, registerables } from "chart.js";
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";

  if (browser) {
    Chart.register(...registerables);
  }

  type StatPill = {
    label: string;
    value: number;
  };

  type DailyBreakdown = { date: string; actions: number };

  type TimeStats = {
    thisWeek: number;
    thisMonth: number;
    thisQuarter: number;
    thisYear: number;
    total: number;
  };

  type UserStatsData = {
    totals: TimeStats;
    dailyBreakdown: DailyBreakdown[];
  };

  type AnonymousStatsData = TimeStats & {
    dailyBreakdown: DailyBreakdown[];
  };

  let {
    userStats = null,
    anonymousStats,
  }: {
    userStats: UserStatsData | null;
    anonymousStats: AnonymousStatsData;
  } = $props();

  const fmt = new Intl.NumberFormat();
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short" });

  const now = new Date();
  const monthLabel = monthFmt.format(now);
  const quarterNum = Math.ceil((now.getMonth() + 1) / 3);
  const yearLabel = String(now.getFullYear());

  const userPills = $derived<StatPill[]>([
    { label: "This Week", value: userStats?.totals.thisWeek ?? 0 },
    { label: `This Month (${monthLabel})`, value: userStats?.totals.thisMonth ?? 0 },
    { label: `This Quarter (Q${quarterNum})`, value: userStats?.totals.thisQuarter ?? 0 },
    { label: `This Year (${yearLabel})`, value: userStats?.totals.thisYear ?? 0 },
  ]);

  const anonPills = $derived<StatPill[]>([
    { label: "This Week", value: anonymousStats.thisWeek },
    { label: `This Month (${monthLabel})`, value: anonymousStats.thisMonth },
    { label: `This Quarter (Q${quarterNum})`, value: anonymousStats.thisQuarter },
    { label: `This Year (${yearLabel})`, value: anonymousStats.thisYear },
  ]);

  let userCanvas: HTMLCanvasElement | undefined = $state();
  let userChartRef: { current: Chart | undefined } = { current: undefined };
  let anonCanvas: HTMLCanvasElement | undefined = $state();
  let anonChartRef: { current: Chart | undefined } = { current: undefined };

  const theme = $derived(
    browser && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );

  const lineColor = $derived(
    theme === "dark" ? "rgba(96,165,250,0.8)" : "rgba(59,130,246,0.8)",
  );
  const fillColor = $derived(
    theme === "dark" ? "rgba(96,165,250,0.08)" : "rgba(59,130,246,0.06)",
  );
  const pointColor = $derived(
    theme === "dark" ? "rgba(96,165,250,0.9)" : "rgba(59,130,246,0.9)",
  );
  const tooltipBg = $derived(
    theme === "dark" ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.95)",
  );
  const tooltipTitleColor = $derived(
    theme === "dark" ? "#f1f5f9" : "#0f172a",
  );
  const tooltipBodyColor = $derived(
    theme === "dark" ? "#94a3b8" : "#475569",
  );
  const tooltipBorderColor = $derived(
    theme === "dark" ? "rgba(51,65,85,0.5)" : "rgba(226,232,240,0.8)",
  );

  function formatDateLabel(date: string): string {
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd}`;
  }

  function destroyChart(ref: { current: Chart | undefined }) {
    if (ref.current) {
      ref.current.destroy();
      ref.current = undefined;
    }
  }

  function renderSparkline(
    canvas: HTMLCanvasElement,
    chartRef: { current: Chart | undefined },
    breakdown: DailyBreakdown[],
  ) {
    destroyChart(chartRef);

    if (breakdown.length === 0) return;

    const labels = breakdown.map((w) => formatDateLabel(w.date));
    const data = breakdown.map((w) => w.actions);

    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Actions",
            data,
            borderColor: lineColor,
            backgroundColor: fillColor,
            pointBackgroundColor: pointColor,
            pointBorderColor: "transparent",
            pointRadius: 3,
            pointHoverRadius: 5,
            pointHitRadius: 10,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipTitleColor,
            bodyColor: tooltipBodyColor,
            borderColor: tooltipBorderColor,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            titleFont: { size: 11, weight: "bold" as const },
            bodyFont: { size: 11 },
            displayColors: false,
          },
        },
        scales: {
          x: { display: false },
          y: { display: false, beginAtZero: true },
        },
        elements: {
          point: {
            hoverBorderWidth: 2,
            hoverBorderColor: lineColor,
          },
        },
        interaction: {
          intersect: false,
          mode: "index" as const,
        },
      },
    });
  }

  $effect(() => {
    userStats;
    userCanvas;
    if (!browser || !userCanvas) return;
    renderSparkline(
      userCanvas,
      userChartRef,
      userStats?.dailyBreakdown ?? [],
    );
  });

  $effect(() => {
    anonymousStats;
    anonCanvas;
    if (!browser || !anonCanvas) return;
    renderSparkline(
      anonCanvas,
      anonChartRef,
      anonymousStats.dailyBreakdown ?? [],
    );
  });

  onDestroy(() => {
    destroyChart(userChartRef);
    destroyChart(anonChartRef);
  });
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {#if userStats !== null && userStats !== undefined}
    <div
      class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm dark:shadow-slate-900/50 p-4"
    >
      <h3
        class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3"
      >
        <ion-icon name="person-outline" style="font-size: 16px;"></ion-icon>
        Your Stats
      </h3>

      <div class="grid grid-cols-2 gap-2 mb-3">
        {#each userPills as pill}
          <div
            class="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
          >
            <p
              class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide"
            >
              {pill.label}
            </p>
            <p
              class="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100"
            >
              {fmt.format(pill.value)}
            </p>
          </div>
        {/each}
      </div>

      {#if userStats.dailyBreakdown.length > 1}
        <div class="h-16 mb-2">
          <canvas bind:this={userCanvas}></canvas>
        </div>
      {/if}

      <p
        class="text-xs text-slate-400 dark:text-slate-500"
      >
        {fmt.format(userStats.totals.total)} total actions
      </p>
    </div>
  {/if}

  <div
    class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm dark:shadow-slate-900/50 p-4"
  >
    <h3
      class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3"
    >
      <ion-icon name="eye-off-outline" style="font-size: 16px;"></ion-icon>
      Anonymous
    </h3>

    <div class="grid grid-cols-2 gap-2 mb-3">
      {#each anonPills as pill}
        <div
          class="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
        >
          <p
            class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide"
          >
            {pill.label}
          </p>
          <p
            class="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100"
          >
            {fmt.format(pill.value)}
          </p>
        </div>
      {/each}
    </div>

    {#if anonymousStats.dailyBreakdown.length > 1}
      <div class="h-16 mb-2">
        <canvas bind:this={anonCanvas}></canvas>
      </div>
    {/if}

    <p
      class="text-xs text-slate-400 dark:text-slate-500"
    >
      {fmt.format(anonymousStats.total)} total actions
    </p>
  </div>
</div>
