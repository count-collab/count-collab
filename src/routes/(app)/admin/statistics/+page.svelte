<script lang="ts">
  import StatisticsChart from "$lib/components/admin/StatisticsChart.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";

  const timeframes = [
    { value: "24h", label: "Past 24h" },
    { value: "7d", label: "Past 7 days" },
    { value: "30d", label: "Past 30 days" },
    { value: "90d", label: "Past 90 days" },
  ] as const;

  const metrics = [
    { metric: "counter_action", title: "Counter Actions" },
    { metric: "counter_created", title: "Counters Created" },
    { metric: "counter_deleted", title: "Counters Deleted" },
    { metric: "dashboard_created", title: "Dashboards Created" },
    { metric: "dashboard_deleted", title: "Dashboards Deleted" },
    { metric: "user_registered", title: "Users Registered" },
    { metric: "user_deleted", title: "Users Deleted" },
    { metric: "goal_created", title: "Goals Created" },
    { metric: "goal_deleted", title: "Goals Deleted" },
    { metric: "goal_reached", title: "Goals Reached" },
    { metric: "invitation_sent", title: "Invitations Sent" },
    { metric: "invitation_accepted", title: "Invitations Accepted" },
    { metric: "invitation_deleted", title: "Invitations Deleted" },
    { metric: "follower_added", title: "Followers Added" },
    { metric: "follower_removed", title: "Followers Removed" },
    { metric: "member_removed", title: "Members Removed" },
  ] as const;

  let selectedTimeframe = $state("30d");
  let selectedMetric = $state("counter_action");
  let selectedUserId = $state<string | null>(null);
  let selectedCounterId = $state<string | null>(null);

  const activeMetric = $derived(
    metrics.find((m) => m.metric === selectedMetric) ?? metrics[0],
  );
</script>

<MetaTags
  title="Statistics | Admin | Count Collab"
  description="Platform usage statistics and trends"
  path="/admin/statistics"
/>

<div class="space-y-8">
  <div>
    <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
      Statistics
    </h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      Platform usage metrics and activity trends over time
    </p>
  </div>

  <div class="flex flex-wrap items-center gap-4">
    <select
      bind:value={selectedMetric}
      onchange={() => {
        selectedUserId = null;
        selectedCounterId = null;
      }}
      class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {#each metrics as m (m.metric)}
        <option value={m.metric}>{m.title}</option>
      {/each}
    </select>

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

  <StatisticsChart
    metric={activeMetric.metric}
    title={activeMetric.title}
    timeframe={selectedTimeframe}
    {selectedUserId}
    {selectedCounterId}
    onUserSelect={(userId) => (selectedUserId = userId)}
    onCounterSelect={(counterId) => (selectedCounterId = counterId)}
  />
</div>
