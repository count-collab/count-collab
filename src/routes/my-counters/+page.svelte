<script lang="ts">
  import CounterCard from "$lib/components/CounterCard.svelte";
  import DashboardCard from "$lib/components/DashboardCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<MetaTags
  title="My Counters | Count Collab"
  description="View and manage your counters."
  path="/my-counters"
/>

<div class="space-y-8">
  <header class="flex items-center justify-between">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
      My Counters
    </h1>
    <a
      href="/create"
      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
    >
      Create New
    </a>
  </header>

  {#if data.dashboards.length > 0}
    <section class="space-y-4">
      <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
        My Dashboards
      </h2>
      <div
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {#each data.dashboards as dashboard (dashboard.id)}
          <DashboardCard {dashboard} showBadges />
        {/each}
      </div>
    </section>
  {/if}

  {#if data.counters.length === 0}
    <div class="text-center py-12">
      <p class="text-slate-500 dark:text-slate-400 mb-4">
        You don't have any counters yet.
      </p>
      <a
        href="/create"
        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
      >
        Create your first counter
      </a>
    </div>
  {:else}
    <div
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      {#each data.counters as counter (counter.id)}
        <CounterCard {counter} showBadges />
      {/each}
    </div>
    <Pagination
      page={data.page}
      totalPages={data.totalPages}
      baseUrl="/my-counters"
    />
  {/if}
</div>
