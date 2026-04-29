<script lang="ts">
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
      <ol class="space-y-0" aria-label="Goals progress">
        {#each sortedGoals as goal, i (goal.id)}
          {@const reached = isGoalReached(goal)}
          {@const progress = goalProgress(goal)}
          {@const showBar = reached || nextGoalIds().has(goal.id)}
          {@const isLast = i === sortedGoals.length - 1}
          <li class="group {isLast ? '' : showBar ? 'pb-1.5' : 'pb-0.5'}">
            <!-- Goal content -->
            <div
              class="flex-1 {isLast ? 'pt-1' : 'py-1'} rounded-lg {reached
                ? 'bg-green-50 dark:bg-green-900/10 px-2 -mx-2'
                : ''}"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0"
                  >
                    {fmt.format(goal.amount)}
                  </span>
                  <span
                    class="text-sm text-slate-600 dark:text-slate-400 truncate"
                  >
                    {goal.description}
                  </span>
                </div>
                <span
                  class="text-xs tabular-nums shrink-0 {reached
                    ? 'text-green-600 dark:text-green-400 font-semibold'
                    : 'text-slate-400 dark:text-slate-500'}"
                >
                  {progress}%
                </span>
              </div>
              <!-- Progress bar -->
              {#if showBar}
                <div
                  class="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                >
                  <div
                    class="h-full rounded-full transition-all duration-300 {reached
                      ? 'bg-green-500'
                      : 'bg-blue-500'}"
                    style="width: {progress}%"
                  ></div>
                </div>
              {/if}
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
{/if}
