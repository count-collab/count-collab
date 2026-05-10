<script lang="ts">
  import { browser } from "$app/environment";

  let {
    field,
    timeframe,
    filters = {},
    onRemove,
  }: {
    field: string;
    timeframe: string;
    filters: Record<string, string>;
    onRemove: () => void;
  } = $props();

  interface AggregateValue {
    value: string;
    count: number;
    label: string;
    extra?: {
      name?: string | null;
      username?: string | null;
      image?: string | null;
    };
  }

  const FIELD_LABELS: Record<string, string> = {
    eventType: "Event Type",
    userId: "User",
    entityId: "Entity ID",
    entityType: "Entity Type",
    counter_id: "Counter ID",
    counter_title: "Counter",
    dashboard_id: "Dashboard ID",
    dashboard_title: "Dashboard",
    goal_amount: "Goal Amount",
    goal_description: "Goal Description",
    user_name: "User",
    invited_email: "Invited Email",
    invited_user_id: "Invited User ID",
    invited_username: "Invited Username",
    role: "Role",
    member_user_id: "Member User ID",
    member_username: "Member Username",
    previous_value: "Previous Value",
    new_value: "New Value",
    change: "Change",
  };

  function labelFor(key: string): string {
    return (
      FIELD_LABELS[key] ??
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  let values = $state<AggregateValue[]>([]);
  let totalCount = $state(0);
  let loading = $state(false);
  let queryDurationMs = $state<number | null>(null);

  const BATCH_SIZE = 20;
  const LOAD_MORE_SIZE = 10;

  let hasMore = $derived(values.length < totalCount);

  async function fetchAggregation(
    offset: number,
    limit: number,
    append: boolean,
  ) {
    loading = true;
    try {
      const params = new URLSearchParams({
        field,
        timeframe,
        limit: String(limit),
        offset: String(offset),
      });
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(`filter.${key}`, value);
      }
      const res = await fetch(`/api/admin/statistics/aggregate?${params}`);
      if (!res.ok) {
        if (!append) {
          values = [];
          totalCount = 0;
        }
        queryDurationMs = null;
        return;
      }
      const data = await res.json();
      if (append) {
        values = [...values, ...data.values];
      } else {
        values = data.values;
      }
      totalCount = data.total;
      queryDurationMs = data.queryDurationMs ?? null;
    } finally {
      loading = false;
    }
  }

  function loadMore() {
    fetchAggregation(values.length, LOAD_MORE_SIZE, true);
  }

  // Refetch when field, timeframe, or filters change
  $effect(() => {
    field;
    timeframe;
    filters;
    if (browser) {
      fetchAggregation(0, BATCH_SIZE, false);
    }
  });
</script>

<div
  class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
>
  <div class="mb-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Aggregation: {labelFor(field)}
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
      <span class="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
        {totalCount.toLocaleString()} unique value{totalCount !== 1 ? "s" : ""}
      </span>
    </div>
    <button
      type="button"
      onclick={onRemove}
      class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
      title="Close aggregation"
    >
      <ion-icon name="close-outline" style="font-size: 18px;"></ion-icon>
    </button>
  </div>

  {#if loading && values.length === 0}
    <div class="flex items-center justify-center py-12">
      <div
        class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
      ></div>
    </div>
  {:else if values.length === 0}
    <div
      class="flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 py-12"
    >
      <p class="text-sm text-slate-400 dark:text-slate-500">
        No data available
      </p>
    </div>
  {:else}
    <table class="w-full">
      <thead>
        <tr class="border-b border-slate-100 dark:border-slate-700">
          <th
            class="pb-2 text-left text-xs font-medium text-slate-400 dark:text-slate-500"
          >
            {labelFor(field)}
          </th>
          <th
            class="pb-2 text-right text-xs font-medium text-slate-400 dark:text-slate-500"
          >
            Count
          </th>
        </tr>
      </thead>
      <tbody>
        {#each values as row, i (row.value)}
          <tr
            class="border-b border-slate-50 dark:border-slate-700/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30"
          >
            <td class="py-2 pr-4">
              {#if field === "userId" && row.extra}
                <div class="flex items-center gap-2.5">
                  {#if row.extra.image}
                    <img
                      src={row.extra.image}
                      alt=""
                      class="h-6 w-6 rounded-full object-cover"
                    />
                  {:else}
                    <div
                      class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600"
                    >
                      <ion-icon
                        name="person-outline"
                        class="text-slate-500 dark:text-slate-300"
                        style="font-size: 12px;"
                      ></ion-icon>
                    </div>
                  {/if}
                  <div class="min-w-0">
                    <span
                      class="text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      {row.extra.name || row.extra.username || row.value}
                    </span>
                    {#if row.extra.username}
                      <span
                        class="ml-1 text-xs text-slate-400 dark:text-slate-500"
                      >
                        @{row.extra.username}
                      </span>
                    {/if}
                  </div>
                </div>
              {:else}
                <span class="text-sm text-slate-700 dark:text-slate-300">
                  {row.label}
                </span>
              {/if}
            </td>
            <td
              class="py-2 text-right tabular-nums text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {row.count.toLocaleString()}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if hasMore}
      <div class="mt-4 flex justify-center">
        <button
          type="button"
          disabled={loading}
          onclick={loadMore}
          class="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {#if loading}
            Loading…
          {:else}
            Show more
          {/if}
        </button>
      </div>
    {/if}
  {/if}
</div>
