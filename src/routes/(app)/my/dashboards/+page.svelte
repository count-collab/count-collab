<script lang="ts">
  import DashboardCard from "$lib/components/DashboardCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<MetaTags
  title="My Dashboards | Count Collab"
  description="All your dashboards — owned, shared, and followed."
  path="/my/dashboards"
/>

<div class="space-y-10">
  <!-- Owned dashboards -->
  <section>
    <div class="flex items-center gap-2 mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Owned</h2>
      <span
        class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"
      >
        {data.ownedDashboards.total}
      </span>
    </div>
    {#if data.ownedDashboards.items.length === 0}
      <div
        class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
      >
        <ion-icon
          name="apps-outline"
          class="text-slate-300 dark:text-slate-600"
          style="font-size: 40px;"
        ></ion-icon>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Create your first dashboard
        </p>
        <a
          href="/create?type=dashboard"
          class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ion-icon name="add-circle-outline" style="font-size: 16px;"></ion-icon>
          Get started
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each data.ownedDashboards.items as dashboard (dashboard.id)}
          <DashboardCard {dashboard} showBadges />
        {/each}
      </div>
    {/if}
  </section>

  <!-- Shared with me -->
  <section>
    <div class="flex items-center gap-2 mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Shared with me</h2>
      <span
        class="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300"
      >
        {data.sharedDashboards.total}
      </span>
    </div>
    {#if data.sharedDashboards.items.length === 0}
      <div
        class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
      >
        <ion-icon
          name="people-outline"
          class="text-slate-300 dark:text-slate-600"
          style="font-size: 40px;"
        ></ion-icon>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No one has shared a dashboard with you yet
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each data.sharedDashboards.items as dashboard (dashboard.id)}
          <DashboardCard {dashboard} showBadges />
        {/each}
      </div>
    {/if}
  </section>

  <!-- Following -->
  <section>
    <div class="flex items-center gap-2 mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Following</h2>
      <span
        class="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400"
      >
        {data.followedDashboards.length}
      </span>
    </div>
    {#if data.followedDashboards.length === 0}
      <div
        class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
      >
        <ion-icon
          name="heart-outline"
          class="text-slate-300 dark:text-slate-600"
          style="font-size: 40px;"
        ></ion-icon>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You're not following any dashboards yet.
        </p>
        <a
          href="/dashboards"
          class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Discover dashboards to follow
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each data.followedDashboards as dashboard (dashboard.id)}
          <DashboardCard {dashboard} showBadges followed />
        {/each}
      </div>
    {/if}
  </section>
</div>
