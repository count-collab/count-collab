<script lang="ts">
  import { page } from "$app/stores";

  const { children } = $props();

  const tabs = [
    { label: "Overview", href: "/my", icon: "grid-outline" },
    { label: "Counters", href: "/my/counters", icon: "pulse-outline" },
    { label: "Dashboards", href: "/my/dashboards", icon: "apps-outline" },
  ];

  const currentPath = $derived($page.url.pathname);

  function isActive(href: string): boolean {
    if (href === "/my") return currentPath === "/my";
    return currentPath.startsWith(href);
  }
</script>

<div>
  <!-- Tabs -->
  <nav
    class="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-8"
    aria-label="Personal space navigation"
  >
    {#each tabs as tab (tab.href)}
      <a
        href={tab.href}
        class="inline-flex items-center gap-1.5 px-4 py-2 -mb-px text-sm font-medium transition-all {isActive(tab.href)
          ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}"
        aria-current={isActive(tab.href) ? "page" : undefined}
      >
        <ion-icon name={tab.icon} style="font-size: 16px;"></ion-icon>
        {tab.label}
      </a>
    {/each}
  </nav>

  <!-- Page content -->
  {@render children()}
</div>
