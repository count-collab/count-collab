<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const stats = $derived([
    {
      label: "Total Users",
      value: data.stats.userCount,
      icon: "people-outline",
      accent: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-900/20",
      iconBg: "bg-violet-100 dark:bg-violet-900/40",
      href: "/admin/users",
    },
    {
      label: "Total Counters",
      value: data.stats.counterCount,
      icon: "trending-up-outline",
      accent: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      href: "/admin/counters",
    },
    {
      label: "Total Dashboards",
      value: data.stats.dashboardCount,
      icon: "grid-outline",
      accent: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      href: "/admin/dashboards",
    },
  ]);
</script>

<MetaTags
  title="Admin Dashboard | Count Collab"
  description="Admin dashboard"
  path="/admin"
/>

<div class="space-y-8">
  <div>
    <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
      Admin Overview
    </h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      Platform statistics and management shortcuts
    </p>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {#each stats as stat (stat.label)}
      <a
        href={stat.href}
        class="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
      >
        <div class="flex items-start justify-between">
          <div>
            <p
              class="text-sm font-medium text-slate-500 dark:text-slate-400"
            >
              {stat.label}
            </p>
            <p class="mt-2 text-3xl font-bold tabular-nums {stat.accent}">
              {stat.value.toLocaleString()}
            </p>
          </div>
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {stat.iconBg} transition-transform group-hover:scale-110"
          >
            <ion-icon
              name={stat.icon}
              class={stat.accent}
              style="font-size: 20px;"
            ></ion-icon>
          </div>
        </div>
      </a>
    {/each}
  </div>
</div>
