<script lang="ts">
  import { untrack } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import AggregationPanel from "$lib/components/admin/AggregationPanel.svelte";
  import EventLog from "$lib/components/admin/EventLog.svelte";
  import StatisticsChart from "$lib/components/admin/StatisticsChart.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";

  const timeframes = [
    { value: "24h", label: "Past 24h" },
    { value: "7d", label: "Past 7 days" },
    { value: "30d", label: "Past 30 days" },
    { value: "90d", label: "Past 90 days" },
  ] as const;

  type Timeframe = (typeof timeframes)[number]["value"];

  const VALID_TIMEFRAMES = new Set<Timeframe>(["24h", "7d", "30d", "90d"]);

  function parseTimeframe(value: string | null): Timeframe {
    if (value && VALID_TIMEFRAMES.has(value as Timeframe)) {
      return value as Timeframe;
    }
    return "30d";
  }

  function parsePage(value: string | null): number {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
    return 1;
  }

  function parseFilters(searchParams: URLSearchParams): Record<string, string> {
    const nextFilters: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (!key.startsWith("filter.")) continue;
      const filterKey = key.slice(7);
      if (!filterKey || !value) continue;
      nextFilters[filterKey] = value;
    }
    return nextFilters;
  }

  function buildQueryString(args: {
    timeframe: Timeframe;
    aggregateField: string | null;
    eventPage: number;
    filters: Record<string, string>;
  }): string {
    const params = new URLSearchParams();

    if (args.timeframe !== "30d") {
      params.set("timeframe", args.timeframe);
    }

    if (args.aggregateField?.trim()) {
      params.set("aggregate", args.aggregateField);
    }

    if (args.eventPage > 1) {
      params.set("page", String(args.eventPage));
    }

    const sortedFilterKeys = Object.keys(args.filters).sort();
    for (const key of sortedFilterKeys) {
      const value = args.filters[key]?.trim();
      if (!value) continue;
      params.set(`filter.${key}`, value);
    }

    return params.toString();
  }

  function areFiltersEqual(
    a: Record<string, string>,
    b: Record<string, string>,
  ): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  }

  let selectedTimeframe = $state<Timeframe>("30d");
  let filters = $state<Record<string, string>>({});
  let aggregateField = $state<string | null>(null);
  let eventPage = $state(1);

  function setTimeframe(nextTimeframe: Timeframe) {
    if (selectedTimeframe === nextTimeframe) return;
    selectedTimeframe = nextTimeframe;
    eventPage = 1;
  }

  function setFilters(nextFilters: Record<string, string>) {
    if (areFiltersEqual(filters, nextFilters)) return;
    filters = nextFilters;
    eventPage = 1;
  }

  function setEventPage(nextPage: number) {
    const normalizedPage =
      Number.isInteger(nextPage) && nextPage > 0 ? nextPage : 1;
    if (eventPage === normalizedPage) return;
    eventPage = normalizedPage;
  }

  $effect(() => {
    const searchParams = page.url.searchParams;

    const nextTimeframe = parseTimeframe(searchParams.get("timeframe"));
    const nextAggregate = searchParams.get("aggregate")?.trim() || null;
    const nextPage = parsePage(searchParams.get("page"));
    const nextFilters = parseFilters(searchParams);

    if (untrack(() => selectedTimeframe) !== nextTimeframe) {
      selectedTimeframe = nextTimeframe;
    }

    if (untrack(() => aggregateField) !== nextAggregate) {
      aggregateField = nextAggregate;
    }

    if (untrack(() => eventPage) !== nextPage) {
      eventPage = nextPage;
    }

    if (
      !areFiltersEqual(
        untrack(() => filters),
        nextFilters,
      )
    ) {
      filters = nextFilters;
    }
  });

  $effect(() => {
    if (!browser) return;

    const nextQuery = buildQueryString({
      timeframe: selectedTimeframe,
      aggregateField,
      eventPage,
      filters,
    });

    if (nextQuery === page.url.searchParams.toString()) return;

    const href = nextQuery
      ? `${page.url.pathname}?${nextQuery}`
      : page.url.pathname;

    goto(href, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  });
</script>

<MetaTags
  title="Metrics | Admin | Count Collab"
  description="Platform event activity and analytics"
  path="/admin/statistics"
/>

<div class="space-y-8">
  <div>
    <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
      Metrics
    </h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      Platform event activity and analytics
    </p>
  </div>

  <div class="flex flex-wrap items-center gap-4">
    <div
      class="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1"
      role="group"
      aria-label="Select timeframe"
    >
      {#each timeframes as tf (tf.value)}
        <button
          type="button"
          onclick={() => setTimeframe(tf.value)}
          class="rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors
            {selectedTimeframe === tf.value
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
          aria-pressed={selectedTimeframe === tf.value}
        >
          {tf.label}
        </button>
      {/each}
    </div>
  </div>

  <StatisticsChart {filters} timeframe={selectedTimeframe} />

  {#if aggregateField}
    <AggregationPanel
      field={aggregateField}
      timeframe={selectedTimeframe}
      {filters}
      onRemove={() => (aggregateField = null)}
    />
  {/if}

  <EventLog
    timeframe={selectedTimeframe}
    page={eventPage}
    {filters}
    onFilterChange={setFilters}
    onPageChange={setEventPage}
    onAggregateField={(f) => (aggregateField = f)}
  />
</div>
