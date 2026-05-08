<script lang="ts">
  import CounterCard from "$lib/components/CounterCard.svelte";
  import DashboardCard from "$lib/components/DashboardCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { counterUrl } from "$lib/counter";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  function relativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  }

  const totalCounters = $derived(
    data.ownedCounters.total + data.sharedCounters.total,
  );
  const totalDashboards = $derived(
    data.ownedDashboards.total + data.sharedDashboards.total,
  );
  const totalFollowing = $derived(
    data.followedCounters.length + data.followedDashboards.length,
  );

  const stats = $derived([
    {
      label: "Total Actions",
      value: data.totalActions,
      icon: "flash-outline",
      accent: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      breakdown: "increments & decrements",
    },
    {
      label: "Counters",
      value: totalCounters,
      icon: "pulse-outline",
      accent: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      breakdown: `${data.ownedCounters.total} owned · ${data.sharedCounters.total} shared`,
    },
    {
      label: "Dashboards",
      value: totalDashboards,
      icon: "apps-outline",
      accent: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      breakdown: `${data.ownedDashboards.total} owned · ${data.sharedDashboards.total} shared`,
    },
    {
      label: "Following",
      value: totalFollowing,
      icon: "heart-outline",
      accent: "text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-100 dark:bg-rose-900/40",
      breakdown: `${data.followedCounters.length} counters · ${data.followedDashboards.length} dashboards`,
    },
  ]);
</script>

<MetaTags
  title="My Overview | Count Collab"
  description="Your counters, dashboards, and activity at a glance."
  path="/my"
/>

<div class="space-y-8">
  <!-- Stat cards -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each stats as stat (stat.label)}
      <div
        class="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">
              {stat.label}
            </p>
            <p class="mt-2 text-3xl font-bold tabular-nums {stat.accent}">
              {stat.value.toLocaleString()}
            </p>
            <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {stat.breakdown}
            </p>
          </div>
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {stat.iconBg}"
          >
            <ion-icon name={stat.icon} class={stat.accent} style="font-size: 20px;"></ion-icon>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Recent Activity -->
  <section>
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
      Recent Activity
    </h2>
    {#if data.recentActivity.length === 0}
      <div
        class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center"
      >
        <ion-icon
          name="time-outline"
          class="text-slate-300 dark:text-slate-600"
          style="font-size: 40px;"
        ></ion-icon>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No recent activity yet
        </p>
      </div>
    {:else}
      <div
        class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700"
      >
        {#each data.recentActivity as activity (activity.id)}
          <div class="flex items-start gap-3 px-4 py-3">
            <div
              class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full {activity.isOwnAction
                ? 'bg-blue-500'
                : 'bg-violet-500'}"
            ></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-700 dark:text-slate-300">
                {#if activity.isOwnAction}
                  You changed
                {:else}
                  <span class="font-medium">{activity.changedByUsername ?? "Someone"}</span> changed
                {/if}
                <a
                  href={counterUrl(activity.counterId, activity.counterTitle)}
                  class="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {activity.counterTitle}
                </a>
                <span class="text-slate-500 dark:text-slate-400">
                  from {activity.previousValue} → {activity.newValue}
                </span>
              </p>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {relativeTime(activity.changedAt)}
              </p>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Counters preview -->
  <section>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Counters</h2>
      <a
        href="/my/counters"
        class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        View all →
      </a>
    </div>
    {#if data.ownedCounters.items.length === 0 && data.sharedCounters.items.length === 0}
      <p class="text-sm text-slate-500 dark:text-slate-400">
        No counters yet. <a href="/create?type=counter" class="text-blue-600 dark:text-blue-400 hover:underline">Create your first counter</a>
      </p>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each data.ownedCounters.items as counter (counter.id)}
          <CounterCard {counter} showBadges />
        {/each}
      </div>
      {#if data.sharedCounters.items.length > 0}
        <p class="text-xs font-medium text-violet-600 dark:text-violet-400 mt-4 mb-2 uppercase tracking-wide">
          Shared with you
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {#each data.sharedCounters.items.slice(0, 2) as counter (counter.id)}
            <CounterCard {counter} showBadges />
          {/each}
        </div>
      {/if}
    {/if}
  </section>

  <!-- Dashboards preview -->
  <section>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Dashboards</h2>
      <a
        href="/my/dashboards"
        class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        View all →
      </a>
    </div>
    {#if data.ownedDashboards.items.length === 0 && data.sharedDashboards.items.length === 0}
      <p class="text-sm text-slate-500 dark:text-slate-400">
        No dashboards yet. <a href="/create?type=dashboard" class="text-blue-600 dark:text-blue-400 hover:underline">Create your first dashboard</a>
      </p>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each data.ownedDashboards.items as dashboard (dashboard.id)}
          <DashboardCard {dashboard} showBadges />
        {/each}
      </div>
      {#if data.sharedDashboards.items.length > 0}
        <p class="text-xs font-medium text-violet-600 dark:text-violet-400 mt-4 mb-2 uppercase tracking-wide">
          Shared with you
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {#each data.sharedDashboards.items.slice(0, 2) as dashboard (dashboard.id)}
            <DashboardCard {dashboard} showBadges />
          {/each}
        </div>
      {/if}
    {/if}
  </section>
</div>
