<script lang="ts">
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import Slider from "$lib/components/Slider.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import type { CounterMode, CounterVisibilityMode } from "$lib/db/schema";

  type Goal = {
    id: number;
    amount: number;
    description: string;
    reachedAt: string | null;
  };

  type LocalGoal = {
    _localId: number;
    id?: number;
    amount: number | null;
    description: string;
    reachedAt: string | null;
  };

  let {
    open = $bindable(),
    counter,
    goals,
    canEdit,
    onsave,
  }: {
    open: boolean;
    counter: {
      id: string;
      title: string;
      description: string | null;
      visibilityMode: CounterVisibilityMode;
      counterMode: CounterMode;
      cooldownEnabled: boolean;
      cooldownSeconds: number;
      goalsEnabled: boolean;
      showAllReachedGoals: boolean;
      scoreboardEnabled: boolean;
    };
    goals: Goal[];
    canEdit: boolean;
    onsave?: () => void;
  } = $props();

  let title = $state("");
  let description = $state("");
  let visibilityMode = $state<CounterVisibilityMode>("public");
  let counterMode = $state<CounterMode>("increment_only");
  let cooldownEnabled = $state(false);
  let cooldownSeconds = $state(5);
  let goalsEnabled = $state(false);
  let showAllReachedGoals = $state(false);
  let scoreboardEnabled = $state(false);
  let localGoals = $state<LocalGoal[]>([]);
  let nextLocalId = $state(1);

  let isSaving = $state(false);
  let saveError = $state("");
  let goalErrors = $state<Set<number>>(new Set());

  // Initialize local state from counter prop when overlay opens
  $effect(() => {
    if (open) {
      title = counter.title;
      description = counter.description ?? "";
      visibilityMode = counter.visibilityMode;
      counterMode = counter.counterMode;
      cooldownEnabled = counter.cooldownEnabled;
      cooldownSeconds = counter.cooldownSeconds;
      goalsEnabled = counter.goalsEnabled;
      showAllReachedGoals = counter.showAllReachedGoals;
      scoreboardEnabled = counter.scoreboardEnabled;
      const mapped = goals.map((g, i) => ({ ...g, _localId: i }));
      localGoals = mapped;
      nextLocalId = goals.length;
      sortedGoals = [...mapped].sort(
        (a, b) => (a.amount ?? 0) - (b.amount ?? 0),
      );
      isSaving = false;
      saveError = "";
      goalErrors = new Set();
    }
  });

  // Body scroll lock
  $effect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  });

  let sortedGoals = $state<LocalGoal[]>([]);
  let unsortedIds = $state<Set<number>>(new Set());

  function sortGoals() {
    const sorted = localGoals.filter((g) => !unsortedIds.has(g._localId));
    sorted.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0));
    const unsorted = localGoals.filter((g) => unsortedIds.has(g._localId));
    sortedGoals = [...sorted, ...unsorted];
  }

  function commitGoalSort(localId: number) {
    const idx = localGoals.findIndex((g) => g._localId === localId);
    if (idx !== -1) {
      const raw = localGoals[idx].amount;
      const parsed = Number.parseInt(String(raw ?? ""), 10);
      localGoals[idx].amount = Number.isNaN(parsed) ? null : parsed;
    }
    unsortedIds.delete(localId);
    unsortedIds = new Set(unsortedIds);
    sortGoals();
  }

  function close() {
    open = false;
  }

  let goalsTableEl: HTMLElement | undefined = $state();

  async function addGoal() {
    const id = nextLocalId++;
    localGoals.push({
      _localId: id,
      amount: null,
      description: "",
      reachedAt: null,
    });
    unsortedIds.add(id);
    unsortedIds = new Set(unsortedIds);
    sortGoals();
    await tick();
    const lastRow = goalsTableEl?.querySelector(
      "tbody tr:last-child input[type='number']",
    ) as HTMLInputElement | null;
    lastRow?.focus();
  }

  function removeGoal(localId: number) {
    localGoals = localGoals.filter((g) => g._localId !== localId);
    sortGoals();
  }

  async function handleSave() {
    if (!canEdit || isSaving) return;
    isSaving = true;
    saveError = "";
    goalErrors = new Set();

    // Validate goals: amount must be a valid integer
    if (goalsEnabled) {
      const invalid = localGoals.filter(
        (g) => g.amount === null || !Number.isInteger(g.amount),
      );
      if (invalid.length > 0) {
        goalErrors = new Set(invalid.map((g) => g._localId));
        saveError = "Some goals have invalid amounts.";
        isSaving = false;
        return;
      }
    }

    try {
      // PATCH counter settings
      const patchRes = await fetch(`/api/counters/${counter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          visibility: visibilityMode,
          counterMode,
          cooldownEnabled,
          cooldownSeconds,
          goalsEnabled,
          showAllReachedGoals,
          scoreboardEnabled,
        }),
      });

      if (!patchRes.ok) {
        const body = await patchRes.json().catch(() => ({}));
        saveError =
          body.error ?? body.message ?? "Failed to save counter settings.";
        return;
      }

      // Sync goals
      const originalIds = new Set(goals.map((g) => g.id));
      const currentIds = new Set(
        localGoals.filter((g) => g.id !== undefined).map((g) => g.id),
      );

      // Deleted goals
      const deletedGoals = goals.filter((g) => !currentIds.has(g.id));
      for (const goal of deletedGoals) {
        const res = await fetch(
          `/api/counters/${counter.id}/goals/${goal.id}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          saveError = "Failed to delete a goal.";
          return;
        }
      }

      // New goals
      const newGoals = localGoals.filter((g) => g.id === undefined);
      for (const goal of newGoals) {
        const res = await fetch(`/api/counters/${counter.id}/goals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: goal.amount,
            description: goal.description,
          }),
        });
        if (!res.ok) {
          saveError = "Failed to create a goal.";
          return;
        }
      }

      // Modified goals
      const modifiedGoals = localGoals.filter((g) => {
        if (g.id === undefined) return false;
        const original = goals.find((og) => og.id === g.id);
        if (!original) return false;
        return (
          original.amount !== g.amount || original.description !== g.description
        );
      });
      for (const goal of modifiedGoals) {
        const res = await fetch(
          `/api/counters/${counter.id}/goals/${goal.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: goal.amount,
              description: goal.description,
            }),
          },
        );
        if (!res.ok) {
          saveError = "Failed to update a goal.";
          return;
        }
      }

      onsave?.();
      close();
    } catch {
      saveError = "Network error. Please try again.";
    } finally {
      isSaving = false;
    }
  }

  const visibilityOptions: {
    value: CounterVisibilityMode;
    label: string;
    icon: string;
    desc: string;
  }[] = [
    {
      value: "public",
      label: "Public",
      icon: "globe-outline",
      desc: "Anyone can view and increment",
    },
    {
      value: "public_readonly",
      label: "Read-only",
      icon: "eye-outline",
      desc: "Anyone can view, only members can increment",
    },
    {
      value: "private",
      label: "Private",
      icon: "lock-closed-outline",
      desc: "Only invited members can access",
    },
  ];

  const counterModeOptions: {
    value: CounterMode;
    label: string;
    icon: string;
    desc: string;
  }[] = [
    {
      value: "increment_only",
      label: "Increment only",
      icon: "add-circle-outline",
      desc: "Count up — perfect for tracking totals",
    },
    {
      value: "decrement_only",
      label: "Decrement only",
      icon: "remove-circle-outline",
      desc: "Count down — great for countdowns",
    },
    {
      value: "both",
      label: "Both",
      icon: "swap-vertical-outline",
      desc: "Count up and down freely",
    },
  ];
</script>

<svelte:window
  onkeydown={(e) => {
    if (open && e.key === "Escape") close();
  }}
/>

{#if open}
  <div
    class="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900"
    role="dialog"
    aria-modal="true"
    aria-label="Counter Settings"
    transition:fade={{ duration: 150 }}
  >
    <!-- Header bar -->
    <div
      class="flex items-center px-4 py-4 border-b border-slate-200 dark:border-slate-700"
    >
      <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
        Counter Settings
      </h2>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto pb-24">
      <div class="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <!-- Section 1: Name & Description -->
        <section class="space-y-4">
          <div class="space-y-4">
            <input
              type="text"
              bind:value={title}
              placeholder="Give it a name..."
              required
              disabled={!canEdit}
              class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-2xl font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              bind:value={description}
              maxlength={500}
              placeholder="Add a description (optional)"
              disabled={!canEdit}
              class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-1 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </section>

        <!-- Section 2: Visibility -->
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Visibility
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {#each visibilityOptions as opt}
              <button
                type="button"
                disabled={!canEdit}
                onclick={() => (visibilityMode = opt.value)}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all
                {!canEdit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                {visibilityMode === opt.value
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <ion-icon
                  name={opt.icon}
                  class="text-3xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >{opt.label}</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                  >{opt.desc}</span
                >
              </button>
            {/each}
          </div>
        </section>

        <!-- Section 3: Counter Mode -->
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Counter Mode
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {#each counterModeOptions as opt}
              <button
                type="button"
                disabled={!canEdit}
                onclick={() => (counterMode = opt.value)}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all
                {!canEdit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                {counterMode === opt.value
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                {#if opt.value === "both"}
                  <span
                    class="flex items-center gap-1 text-3xl text-blue-600 dark:text-blue-400"
                  >
                    <ion-icon name="add-circle-outline"></ion-icon>
                    <ion-icon name="remove-circle-outline"></ion-icon>
                  </span>
                {:else}
                  <ion-icon
                    name={opt.icon}
                    class="text-3xl text-blue-600 dark:text-blue-400"
                  ></ion-icon>
                {/if}
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >{opt.label}</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                  >{opt.desc}</span
                >
              </button>
            {/each}
          </div>
        </section>

        <!-- Section 4: Cooldown -->
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Cooldown
          </h3>
          <Switch
            bind:checked={cooldownEnabled}
            label="Enable counter cooldown"
            disabled={!canEdit}
          />
          {#if cooldownEnabled}
            <div class="mt-3">
              <Slider
                bind:value={cooldownSeconds}
                min={1}
                max={60}
                step={1}
                unit="s"
                disabled={!canEdit}
              />
            </div>
          {/if}
          <p class="text-sm text-slate-500 dark:text-slate-400">
            How often should users be able to increment/decrement the counter?
          </p>
        </section>

        <!-- Section 5: Goals -->
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Goals
          </h3>
          <Switch
            bind:checked={goalsEnabled}
            label="Enable counter goals"
            disabled={!canEdit}
          />
          {#if goalsEnabled}
            <div
              class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <table bind:this={goalsTableEl} class="w-full">
                <thead>
                  <tr
                    class="bg-slate-50 dark:bg-slate-800/50 text-left text-sm font-medium text-slate-600 dark:text-slate-400"
                  >
                    <th class="px-4 py-3">Amount</th>
                    <th class="px-4 py-3">Description</th>
                    <th class="px-4 py-3 w-16">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {#each sortedGoals as goal (goal._localId)}
                    {@const idx = localGoals.findIndex(
                      (g) => g._localId === goal._localId,
                    )}
                    <tr
                      class="border-b border-slate-100 dark:border-slate-700/50"
                    >
                      <td class="px-4 py-2">
                        <input
                          type="number"
                          bind:value={localGoals[idx].amount}
                          onblur={() => commitGoalSort(goal._localId)}
                          disabled={!canEdit}
                          class="w-24 rounded-lg border bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed {goalErrors.has(
                            goal._localId,
                          )
                            ? 'border-red-500 dark:border-red-500'
                            : 'border-slate-300 dark:border-slate-600'}"
                        />
                      </td>
                      <td class="px-4 py-2">
                        <input
                          type="text"
                          bind:value={localGoals[idx].description}
                          placeholder="Goal description"
                          disabled={!canEdit}
                          class="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td class="px-4 py-2">
                        <button
                          type="button"
                          onclick={() => removeGoal(goal._localId)}
                          disabled={!canEdit}
                          class="p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Delete goal"
                        >
                          <ion-icon
                            name="trash-outline"
                            style="font-size: 18px;"
                          ></ion-icon>
                        </button>
                      </td>
                    </tr>
                  {/each}
                  {#if sortedGoals.length === 0}
                    <tr>
                      <td
                        colspan="3"
                        class="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500"
                      >
                        No goals yet
                      </td>
                    </tr>
                  {/if}
                </tbody>
              </table>
            </div>
            <div class="flex items-center justify-between">
              {#if canEdit}
                <button
                  type="button"
                  onclick={addGoal}
                  class="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <ion-icon name="add-circle-outline" style="font-size: 18px;"
                  ></ion-icon>
                  Add goal
                </button>
              {/if}
              {#if goalErrors.size > 0}
                <span class="text-sm text-red-600 dark:text-red-400">
                  {saveError}
                </span>
              {/if}
            </div>
            <Switch
              bind:checked={showAllReachedGoals}
              label="Show all reached goals"
              disabled={!canEdit}
            />
            <p class="text-sm text-slate-500 dark:text-slate-400">
              When enabled, all reached goals are displayed. Otherwise only the
              latest reached goal is shown.
            </p>
          {/if}
        </section>

        <!-- Section 6: Scoreboard -->
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Scoreboard
          </h3>
          <Switch
            bind:checked={scoreboardEnabled}
            label="Show scoreboard"
            disabled={!canEdit}
          />
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Display a ranked list of top contributors on the counter page.
          </p>
        </section>
      </div>
    </div>

    <!-- Fixed bottom save bar -->
    <div
      class="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
    >
      <div class="max-w-2xl mx-auto space-y-2">
        {#if saveError && goalErrors.size === 0}
          <p class="text-sm text-red-600 dark:text-red-400">{saveError}</p>
        {/if}
        <div class="flex items-center justify-end gap-3">
          <button
            type="button"
            onclick={close}
            class="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={handleSave}
            disabled={!canEdit || isSaving || !title.trim()}
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isSaving}
              Saving…
            {:else}
              Save changes
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
