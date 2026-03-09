<script lang="ts">
  import { untrack } from "svelte";
  import { browser } from "$app/environment";
  import { goto, invalidate } from "$app/navigation";
  import CounterCard from "$lib/components/CounterCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
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
      const params = new URLSearchParams();

      if (nextQuery) {
        params.set("q", nextQuery);
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

<MetaTags
  title="Counter Browser | Count Collab"
  description="Browse and track public counters in real-time."
  path="/counters"
/>

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
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {#each data.counters as counter (counter.id)}
        <CounterCard {counter} />
      {/each}
    </div>
    <Pagination
      page={data.page}
      totalPages={data.totalPages}
      baseUrl="/counters"
      extraParams={data.query ? { q: data.query } : {}}
    />
  {/if}
</div>
