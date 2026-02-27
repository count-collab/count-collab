<script lang="ts">
  import { browser } from "$app/environment";
  import { invalidate } from "$app/navigation";
  import { onCounterCreated, onCounterUpdated } from "$lib/stores/counters";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  $effect(() => {
    if (!browser) return;

    const unsubUpdate = onCounterUpdated(() => {
      invalidate("counters:list");
    });

    const unsubCreated = onCounterCreated(() => {
      invalidate("counters:list");
    });

    return () => {
      unsubUpdate();
      unsubCreated();
    };
  });
</script>

<svelte:head>
  <title>Counter Browser | Count Collab</title>
  <meta name="description" content="Browse and track public counters in real-time." />
</svelte:head>

<div class="space-y-6">
  <header class="flex flex-col gap-2">
    <h1 class="text-3xl font-bold text-slate-900">Counter Browser</h1>
    <p class="text-slate-600">
      Explore public counters and follow the latest activity.
    </p>
  </header>

  {#if data.counters.length === 0}
    <div
      class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600"
    >
      No public counters yet. <a href="/create" class="text-blue-600"
        >Create one</a
      > to get started.
    </div>
  {:else}
    <div class="grid gap-4">
      {#each data.counters as counter (counter.id)}
        <a
          href={`/c/${counter.id}`}
          class="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400"
        >
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">
                {counter.title}
              </h2>
              {#if counter.description}
                <p class="text-sm text-slate-600">{counter.description}</p>
              {/if}
            </div>
            <div class="text-3xl font-bold text-blue-600">{counter.count}</div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
