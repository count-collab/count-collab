<script lang="ts">
  import CounterCard from "$lib/components/CounterCard.svelte";
  import DashboardCard from "$lib/components/DashboardCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<MetaTags
  title="My Counters & Dashboards | Count Collab"
  description="View and manage your counters and dashboards."
  path="/my-counters"
/>

<div class="space-y-8">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    My Counters & Dashboards
  </h1>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <!-- Counters column -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
          Counters
        </h2>
        <a
          href="/create"
          class="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold inline-flex items-center gap-1.5"
        >
          <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
          New Counter
        </a>
      </div>

      {#if data.counters.length === 0}
        <div
          class="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
        >
          <p class="text-slate-500 dark:text-slate-400 mb-4">
            You don't have any counters yet.
          </p>
          <a
            href="/create"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
          >
            Create your first counter
          </a>
        </div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {#if data.followedCounters.length > 0}
        <div class="pt-4 border-t border-slate-200 dark:border-slate-700">
          <h3
            class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3"
          >
            Following
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {#each data.followedCounters as counter (counter.id)}
              <CounterCard {counter} showBadges followed />
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <!-- Dashboards column -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
          Dashboards
        </h2>
        <a
          href="/create/dashboard"
          class="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition text-sm font-semibold inline-flex items-center gap-1.5"
        >
          <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
          New Dashboard
        </a>
      </div>

      {#if data.dashboards.length === 0}
        <div
          class="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
        >
          <p class="text-slate-500 dark:text-slate-400 mb-4">
            You don't have any dashboards yet.
          </p>
          <a
            href="/create/dashboard"
            class="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition text-sm font-semibold"
          >
            Create your first dashboard
          </a>
        </div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {#each data.dashboards as dashboard (dashboard.id)}
            <DashboardCard {dashboard} showBadges />
          {/each}
        </div>
      {/if}

      {#if data.followedDashboards.length > 0}
        <div class="pt-4 border-t border-slate-200 dark:border-slate-700">
          <h3
            class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3"
          >
            Following
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {#each data.followedDashboards as dashboard (dashboard.id)}
              <DashboardCard {dashboard} showBadges followed />
            {/each}
          </div>
        </div>
      {/if}
    </section>
  </div>
</div>
