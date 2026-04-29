<script lang="ts">
  type ScoreboardEntry = {
    userId: string;
    username: string | null;
    image: string | null;
    actionCount: number;
  };

  type Props = {
    scoreboard: ScoreboardEntry[];
  };

  const { scoreboard }: Props = $props();

  const fmt = new Intl.NumberFormat();

  let expanded = $state(false);

  const INITIAL_COUNT = 5;
  const EXPANDED_COUNT = 10;

  const visibleEntries = $derived(
    expanded
      ? scoreboard.slice(0, EXPANDED_COUNT)
      : scoreboard.slice(0, INITIAL_COUNT),
  );

  const hasMore = $derived(scoreboard.length > INITIAL_COUNT);
  const hasScrollable = $derived(scoreboard.length > EXPANDED_COUNT);
  const showExpandToggle = $derived(
    hasMore && (!expanded || scoreboard.length <= EXPANDED_COUNT),
  );

  const rankColor = (rank: number): string => {
    if (rank === 1) return "text-amber-500";
    if (rank === 2) return "text-slate-400";
    if (rank === 3) return "text-amber-700";
    return "text-slate-500 dark:text-slate-400";
  };
</script>

<div
  class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm dark:shadow-slate-900/50 p-4"
>
  <h3
    class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3"
  >
    <ion-icon name="trophy-outline" style="font-size: 16px;"></ion-icon>
    Top Contributors
  </h3>

  {#if scoreboard.length === 0}
    <p class="text-sm text-slate-400 dark:text-slate-500">No activity yet</p>
  {:else}
    <ol
      class="space-y-0 {expanded && hasScrollable
        ? 'max-h-80 overflow-y-auto'
        : ''}"
      aria-label="Top contributors"
    >
      {#if expanded && hasScrollable}
        {#each scoreboard as entry, i (entry.userId)}
          {@const rank = i + 1}
          <li class="flex items-center gap-2 py-1.5 last:pb-0 rounded-lg">
            <span
              class="text-sm font-bold tabular-nums shrink-0 {rankColor(rank)}"
            >
              #{rank}
            </span>
            <span
              class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate min-w-0 flex-1"
            >
              {entry.username ?? "Anonymous"}
            </span>
            <span
              class="text-sm tabular-nums text-slate-500 dark:text-slate-400 shrink-0"
            >
              {fmt.format(entry.actionCount)}
            </span>
          </li>
        {/each}
      {:else}
        {#each visibleEntries as entry, i (entry.userId)}
          {@const rank = i + 1}
          <li class="flex items-center gap-2 py-1.5 last:pb-0 rounded-lg">
            <span
              class="text-sm font-bold tabular-nums shrink-0 {rankColor(rank)}"
            >
              #{rank}
            </span>
            <span
              class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate min-w-0 flex-1"
            >
              {entry.username ?? "Anonymous"}
            </span>
            <span
              class="text-sm tabular-nums text-slate-500 dark:text-slate-400 shrink-0"
            >
              {fmt.format(entry.actionCount)}
            </span>
          </li>
        {/each}
      {/if}
    </ol>

    {#if showExpandToggle}
      <button
        type="button"
        onclick={() => (expanded = !expanded)}
        class="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:text-slate-300"
        aria-label={expanded
          ? "Show fewer contributors"
          : "Show more contributors"}
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    {/if}
  {/if}
</div>
