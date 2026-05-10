<script lang="ts">
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

  let selectedTimeframe = $state("30d");
  let filters = $state<Record<string, string>>({});
  let aggregateField = $state<string | null>(null);
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
          onclick={() => (selectedTimeframe = tf.value)}
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
    {filters}
    onFilterChange={(f) => (filters = f)}
    onAggregateField={(f) => (aggregateField = f)}
  />
</div>
