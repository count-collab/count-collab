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
    showAllReachedGoals?: boolean;
    compact?: boolean;
  };

  const {
    goals,
    currentCount,
    counterMode,
    showAllReachedGoals = false,
    compact = false,
  }: Props = $props();

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
    // e.g. goal=-5, count=-2 → 40%; goal=-5, count=2 → -40%
    if (goal.amount < 0) {
      const raw = Math.floor((currentCount / goal.amount) * 100);
      return Math.min(99, raw);
    }

    if (counterMode === "decrement_only") {
      if (currentCount <= goal.amount) return 100;
      return Math.floor((goal.amount / currentCount) * 100);
    }
    // Positive goals: progress from 0 upward
    // e.g. goal=10, count=4 → 40%; goal=10, count=-3 → -30%
    const raw = Math.floor((currentCount / goal.amount) * 100);
    return Math.min(99, raw);
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

  // Only show the latest reached goal + all unreached goals (or all goals if showAllReachedGoals is true)
  const visibleGoals = $derived(
    showAllReachedGoals
      ? sortedGoals
      : sortedGoals.filter(
          (g) => !isGoalReached(g) || g.id === lastReachedGoalId(),
        ),
  );
</script>

{#if compact}
  <!-- Compact / mobile layout -->
  <div
    class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
  >
    {#if reachedCount > 0}
      <ion-icon
        name="checkmark-circle"
        style="font-size: 16px;"
        class="text-emerald-500 dark:text-emerald-400"
      ></ion-icon>
    {:else}
      <ion-icon name="trophy-outline" style="font-size: 16px;"></ion-icon>
    {/if}
    <span class="font-medium">
      <span class="text-emerald-600 dark:text-emerald-400"
        >{reachedCount}</span
      >/{goals.length} goals
    </span>
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
    class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm dark:shadow-slate-900/50 py-4"
  >
    <h3
      class="px-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3"
    >
      <ion-icon name="trophy-outline" style="font-size: 16px;"></ion-icon>
      Goals
      <span
        class="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums {reachedCount === goals.length
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}"
      >
        {reachedCount}/{goals.length}
      </span>
    </h3>

    {#if sortedGoals.length === 0}
      <p class="px-4 text-sm text-slate-400 dark:text-slate-500">No goals set.</p>
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
            ? "max-h-[12rem] overflow-y-auto overflow-x-hidden"
            : "overflow-x-hidden"}
        >
          <ol class="space-y-1 px-2" aria-label="Goals progress">
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
                    ? 'pb-1'
                    : 'pb-0.5'} {isLatestReached ? 'overflow-visible' : ''}"
              >
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <div
                  class="relative flex-1 overflow-visible px-2 rounded-lg transition-colors duration-150 {isLatestReached
                    ? 'py-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 rounded-xl'
                    : 'py-1.5'} {isPreviouslyReached
                      ? 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/15'
                      : !reached
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : ''}"
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
                      {#if reached}
                        <ion-icon
                          name="checkmark-circle"
                          style="font-size: {isLatestReached ? '18px' : '16px'};"
                          class="shrink-0 {isLatestReached
                            ? 'text-emerald-500 dark:text-emerald-400'
                            : 'text-emerald-400 dark:text-emerald-500'}"
                        ></ion-icon>
                      {/if}
                      <span
                        class="tabular-nums shrink-0 {isPreviouslyReached
                          ? 'text-sm text-emerald-600/70 dark:text-emerald-400/70 line-through decoration-emerald-400/40'
                          : isLatestReached
                            ? 'text-sm font-bold text-emerald-700 dark:text-emerald-300'
                            : 'text-sm font-bold text-slate-900 dark:text-slate-100'}"
                      >
                        {fmt.format(goal.amount)}
                      </span>
                      <span
                        class="truncate transition-opacity duration-200 {isPreviouslyReached
                          ? 'text-sm text-slate-500 dark:text-slate-400'
                          : isLatestReached
                            ? 'text-sm font-medium text-emerald-700 dark:text-emerald-300'
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
                        class="text-xs tabular-nums shrink-0 {progress < 0 ? 'text-red-400 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}"
                      >
                        {progress}%
                      </span>
                    {/if}
                    {#if isPreviouslyReached}
                      <span
                        class="shrink-0 text-xs font-medium whitespace-nowrap text-emerald-500/80 dark:text-emerald-400/70 transition-opacity duration-200 {tappedGoalId === goal.id ? 'opacity-0' : 'group-hover:opacity-0'}"
                      >
                        {#if goal.reachedAt}
                          {dateFmt.format(new Date(goal.reachedAt))}
                        {:else}
                          reached
                        {/if}
                      </span>
                    {/if}
                    <!-- Reached date text (shown on hover/tap, replaces description) -->
                    {#if reached}
                      <span
                        class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 pr-2 text-xs font-medium whitespace-nowrap transition-opacity duration-200 {isLatestReached
                          ? 'opacity-100 text-emerald-600 dark:text-emerald-300'
                          : 'opacity-0 group-hover:opacity-100 text-emerald-500 dark:text-emerald-400'}"
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
                      class="mt-1.5 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                    >
                      <div
                        class="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse"
                        style="width: {Math.max(0, progress)}%"
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
