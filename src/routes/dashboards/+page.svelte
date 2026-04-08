<script lang="ts">
  import { untrack } from "svelte";
  import { browser } from "$app/environment";
  import { goto, invalidate } from "$app/navigation";
  import DashboardCard from "$lib/components/DashboardCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import {
    onDashboardCreated,
    onDashboardUpdated,
  } from "$lib/stores/dashboards";
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
      const href = queryString ? `/dashboards?${queryString}` : "/dashboards";

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

    const unsubUpdate = onDashboardUpdated(() => {
      invalidate("dashboards:list");
    });

    const unsubCreated = onDashboardCreated(() => {
      invalidate("dashboards:list");
    });

    return () => {
      unsubUpdate();
      unsubCreated();
    };
  });

  const visibleUserDashboards = $derived(data.userDashboards.slice(0, 6));
</script>

<MetaTags
  title="Dashboard Browser | Count Collab"
  description="Browse and explore public dashboards."
  path="/dashboards"
/>

<div class="space-y-8">
  {#if data.userDashboards.length > 0}
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
          My Dashboards
        </h2>
        {#if data.userDashboards.length > 6}
          <a
            href="/my-counters"
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all
          </a>
        {/if}
      </div>
      <div
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {#each visibleUserDashboards as dashboard (dashboard.id)}
          <DashboardCard {dashboard} showBadges />
        {/each}
      </div>
    </section>
  {/if}

  <section class="space-y-6">
    <header class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Browse Dashboards
        </h1>
        {#if data.session?.user}
          <a
            href="/create/dashboard"
            class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-1.5"
          >
            <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
            Create Dashboard
          </a>
        {/if}
      </div>
      <p class="text-slate-600 dark:text-slate-400">
        Explore public dashboards and discover collections of counters.
      </p>
      <div class="max-w-lg pt-2">
        <label
          for="dashboard-search"
          class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Search dashboards
        </label>
        <input
          id="dashboard-search"
          type="search"
          placeholder="Search by title"
          bind:value={search}
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-800"
        />
      </div>
    </header>

    {#if data.dashboards.length === 0}
      {#if data.query}
        <div
          class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-600 dark:text-slate-400"
        >
          No dashboards match "<span class="font-semibold">{data.query}</span>".
          <a href="/dashboards" class="text-blue-600 dark:text-blue-400"
            >Clear search</a
          >.
        </div>
      {:else}
        <div
          class="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-600 dark:text-slate-400"
        >
          No public dashboards yet.
        </div>
      {/if}
    {:else}
      <div
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {#each data.dashboards as dashboard (dashboard.id)}
          <DashboardCard {dashboard} />
        {/each}
      </div>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        baseUrl="/dashboards"
        extraParams={data.query ? { q: data.query } : {}}
      />
    {/if}
  </section>
</div>
