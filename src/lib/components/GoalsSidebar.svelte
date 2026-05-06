<script lang="ts">
  import GoalFireworks from "./GoalFireworks.svelte";

  type Goal = {
    id: number;
    amount: number;
    description: string;
    reachedAt: string | null;
  };

  type Props = {
    goals: Goal[];
    currentCount: number;
    counterMode: "increment_only" | "decrement_only" | "both";
    compact?: boolean;
  };

  const { goals, currentCount, counterMode, compact = false }: Props = $props();

  const fmt = new Intl.NumberFormat();
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  let tappedGoalId = $state<number | null>(null);
  let fireworkTriggers = $state<Record<number, number>>({});
  let scrollContainer: HTMLDivElement | undefined = $state();
  let canScrollUp = $state(false);
  let canScrollDown = $state(false);

  function updateScrollIndicators() {
    if (!scrollContainer || visibleGoals.length <= 5) {
      canScrollUp = false;
      canScrollDown = false;
      return;
    }
    canScrollUp = scrollContainer.scrollTop > 2;
    canScrollDown =
      scrollContainer.scrollTop + scrollContainer.clientHeight <
      scrollContainer.scrollHeight - 2;
  }

  $effect(() => {
    if (!scrollContainer || visibleGoals.length <= 5) return;
    const nextIds = nextGoalIds();
    if (nextIds.size === 0) return;
    const firstNextId = [...nextIds][0];
    const el = scrollContainer.querySelector(`[data-goal-id="${firstNextId}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });

  $effect(() => {
    if (!scrollContainer) return;
    updateScrollIndicators();
  });

  function handleGoalTap(goalId: number, _reachedAt: string | null) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || !isGoalReached(goal)) return;
    tappedGoalId = tappedGoalId === goalId ? null : goalId;
  }

  const isGoalReached = (goal: Goal): boolean => {
    if (goal.reachedAt) return true;
    if (goal.amount < 0) return currentCount <= goal.amount;
    if (counterMode === "decrement_only") return currentCount <= goal.amount;
    return currentCount >= goal.amount;
  };

  const goalProgress = (goal: Goal): number => {
    if (isGoalReached(goal)) return 100;
    if (goal.amount === 0) return 0;

    // Negative goals: progress from 0 toward the negative target
    if (goal.amount < 0) {
      if (currentCount >= 0) return 0;
      // currentCount is negative, goal.amount is negative
      // e.g. goal=-20, count=-10 → 10/20 = 50%
      return Math.min(100, Math.round((currentCount / goal.amount) * 100));
    }

    if (counterMode === "decrement_only") {
      if (currentCount <= goal.amount) return 100;
      return Math.round((goal.amount / currentCount) * 100);
    }
    // Positive goals: progress from 0 upward
    if (currentCount <= 0) return 0;
    return Math.min(100, Math.round((currentCount / goal.amount) * 100));
  };

  const sortedGoals = $derived(
    [...goals].sort((a, b) => {
      if (counterMode === "decrement_only") return b.amount - a.amount;
      return a.amount - b.amount;
    }),
  );

  const reachedCount = $derived(sortedGoals.filter(isGoalReached).length);

  // The last (highest) completed goal gets the prominent checkmark style
  const lastReachedGoalId = $derived(() => {
    const reached = sortedGoals.filter(isGoalReached);
    return reached.length > 0 ? reached[reached.length - 1].id : null;
  });

  // IDs of the next unreached goal(s) — one positive, one negative
  const nextGoalIds = $derived(() => {
    const ids = new Set<number>();
    const nextPositive = sortedGoals.find(
      (g) => g.amount > 0 && !isGoalReached(g),
    );
    const nextNegative = [...sortedGoals]
      .reverse()
      .find((g) => g.amount < 0 && !isGoalReached(g));
    if (nextPositive) ids.add(nextPositive.id);
    if (nextNegative) ids.add(nextNegative.id);
    return ids;
  });

  const nextGoal = $derived(sortedGoals.find((g) => !isGoalReached(g)) ?? null);

  // Only show the latest reached goal + all unreached goals
  const visibleGoals = $derived(
    sortedGoals.filter(
      (g) => !isGoalReached(g) || g.id === lastReachedGoalId(),
    ),
  );
</script>

{#if compact}
  <!-- Compact / mobile layout -->
  <div
    class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
  >
    <ion-icon name="flag-outline" style="font-size: 16px;"></ion-icon>
    <span class="font-medium">{reachedCount}/{goals.length} goals</span>
    {#if nextGoal}
      <span class="text-slate-400 dark:text-slate-500">·</span>
      <span class="truncate">
        Next: {fmt.format(nextGoal.amount)} — {nextGoal.description}
      </span>
    {/if}
  </div>
{:else}
  <!-- Full sidebar layout -->
  <div
    class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm dark:shadow-slate-900/50 p-4"
  >
    <h3
      class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3"
    >
      <ion-icon name="flag-outline" style="font-size: 16px;"></ion-icon>
      Goals
    </h3>

    {#if sortedGoals.length === 0}
      <p class="text-sm text-slate-400 dark:text-slate-500">No goals set.</p>
    {:else}
      <div class="relative">
        {#if canScrollUp}
          <div
            class="pointer-events-none absolute top-0 left-0 right-0 h-6 z-20 bg-gradient-to-b from-white/90 dark:from-slate-900/90 to-transparent"
          ></div>
        {/if}
        <div
          bind:this={scrollContainer}
          onscroll={updateScrollIndicators}
          class={visibleGoals.length > 5
            ? "max-h-[10.5rem] overflow-y-auto overflow-x-hidden"
            : "overflow-x-hidden"}
        >
          <ol class="space-y-0 px-1 -mx-3" aria-label="Goals progress">
            {#each visibleGoals as goal, i (goal.id)}
              {@const reached = isGoalReached(goal)}
              {@const progress = goalProgress(goal)}
              {@const showBar = !reached && nextGoalIds().has(goal.id)}
              {@const isLast = i === visibleGoals.length - 1}
              {@const isLatestReached =
                reached && lastReachedGoalId() === goal.id}
              {@const isPreviouslyReached = reached && !isLatestReached}
              <li
                data-goal-id={goal.id}
                class="group {isLast
                  ? ''
                  : showBar
                    ? 'pb-1.5'
                    : 'pb-0.5'} {isLatestReached ? 'overflow-visible' : ''}"
              >
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <div
                  class="relative flex-1 overflow-visible px-2 {isLast
                    ? 'pt-1'
                    : 'py-1'} {isLatestReached
                    ? 'outline-solid outline-offset-2 outline-green-50 dark:outline-green-900/10 py-2 rounded-xl'
                    : ''}"
                  role={reached ? "button" : undefined}
                  tabindex={reached ? 0 : undefined}
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      handleGoalTap(goal.id, goal.reachedAt);
                  }}
                  onclick={() => handleGoalTap(goal.id, goal.reachedAt)}
                  onmouseenter={() => {
                    if (isLatestReached) {
                      fireworkTriggers[goal.id] =
                        (fireworkTriggers[goal.id] ?? 0) + 1;
                    }
                  }}
                >
                  {#if isLatestReached}
                    <GoalFireworks trigger={fireworkTriggers[goal.id] ?? 0} />
                  {/if}
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span
                        class="tabular-nums shrink-0 {isPreviouslyReached
                          ? 'text-xs text-slate-400 dark:text-slate-500'
                          : 'text-sm font-bold text-slate-900 dark:text-slate-100'}"
                      >
                        {fmt.format(goal.amount)}
                      </span>
                      <span
                        class="truncate transition-opacity duration-200 {isPreviouslyReached
                          ? 'text-xs text-slate-400 dark:text-slate-500'
                          : 'text-sm text-slate-600 dark:text-slate-400'} {isLatestReached
                          ? 'opacity-0'
                          : reached
                            ? 'group-hover:opacity-0'
                            : ''}"
                        class:!opacity-0={reached && tappedGoalId === goal.id}
                      >
                        {goal.description}
                      </span>
                    </div>
                    {#if !reached}
                      <span
                        class="text-xs tabular-nums shrink-0 text-slate-400 dark:text-slate-500"
                      >
                        {progress}%
                      </span>
                    {/if}
                    <!-- Reached date text (replaces checkmark/description on hover) -->
                    {#if reached}
                      <span
                        class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 pr-2 text-xs font-medium whitespace-nowrap transition-opacity duration-200 {isLatestReached
                          ? 'opacity-100 text-green-700 dark:text-green-300'
                          : 'opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500'}"
                        class:!opacity-100={tappedGoalId === goal.id}
                        aria-hidden="true"
                      >
                        {#if goal.reachedAt}
                          reached {dateFmt.format(new Date(goal.reachedAt))}
                        {:else}
                          reached
                        {/if}
                      </span>
                    {/if}
                  </div>
                  <!-- Progress bar (only for unreached goals) -->
                  {#if showBar}
                    <div
                      class="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                    >
                      <div
                        class="h-full rounded-full transition-all duration-300 bg-blue-500"
                        style="width: {progress}%"
                      ></div>
                    </div>
                  {/if}
                </div>
              </li>
            {/each}
          </ol>
        </div>
        {#if canScrollDown}
          <div
            class="pointer-events-none absolute bottom-0 left-0 right-0 h-6 z-20 bg-gradient-to-t from-white/90 dark:from-slate-900/90 to-transparent"
          ></div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
