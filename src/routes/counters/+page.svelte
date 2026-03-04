<script lang="ts">
  
  import { untrack } from "svelte";
import { browser } from "$app/environment";
  import { goto, invalidate } from "$app/navigation";
  import { onCounterCreated, onCounterUpdated } from "$lib/stores/counters";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
  const currentQuery = $derived(data.query);
  let search = $state("");

  $effect(() => {
    const nextQuery = currentQuery;
    const currentSearch = untrack(() => search);

    if (currentSearch !== nextQuery) {
      search = nextQuery;
    }
  });

  $effect(() => {
    if (!browser) return;

    const nextQuery = search.trim();
    const previousQuery = currentQuery;

    if (nextQuery === previousQuery) return;

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);

      if (nextQuery) {
        params.set("q", nextQuery);
      } else {
        params.delete("q");
      }

      const queryString = params.toString();
      const href = queryString ? `/counters?${queryString}` : "/counters";

      goto(href, {
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      });
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  });

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
  <meta
    name="description"
    content="Browse and track public counters in real-time."
  />
</svelte:head>

<div class="space-y-6">
  <header class="flex flex-col gap-2">
    <h1 class="text-3xl font-bold text-slate-900">Counter Browser</h1>
    <p class="text-slate-600">
      Explore public counters and follow the latest activity.
    </p>
    <div class="max-w-lg pt-2">
      <label
        for="counter-search"
        class="mb-1 block text-sm font-medium text-slate-700"
        >Search counters</label
      >
      <input
        id="counter-search"
        type="search"
        placeholder="Search by title or description"
        bind:value={search}
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  </header>

  {#if data.counters.length === 0}
    {#if data.query}
      <div
        class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600"
      >
        No counters match "<span class="font-semibold">{data.query}</span>".
        <a href="/counters" class="text-blue-600">Clear search</a>.
      </div>
    {:else}
      <div
        class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600"
      >
        No public counters yet. <a href="/create" class="text-blue-600"
          >Create one</a
        > to get started.
      </div>
    {/if}
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
