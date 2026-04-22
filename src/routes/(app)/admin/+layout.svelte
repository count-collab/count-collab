<script lang="ts">
  import { page } from "$app/stores";

  const { children } = $props();

  const navItems = [
    { href: "/admin", label: "Overview", icon: "sparkles-outline", exact: true },
    { href: "/admin/users", label: "Users", icon: "people-outline", exact: false },
    { href: "/admin/counters", label: "Counters", icon: "trending-up-outline", exact: false },
    { href: "/admin/dashboards", label: "Dashboards", icon: "grid-outline", exact: false },
  ];

  function isActive(href: string, exact: boolean, pathname: string): boolean {
    return exact ? pathname === href : pathname.startsWith(href);
  }
</script>

<div class="space-y-6">
  <nav
    class="flex gap-1 border-b border-slate-200 dark:border-slate-700 pb-px overflow-x-auto"
  >
    {#each navItems as item (item.href)}
      {@const active = isActive(item.href, item.exact, $page.url.pathname)}
      <a
        href={item.href}
        class="relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap
          {active
          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}"
      >
        <ion-icon name={item.icon} style="font-size: 16px;"></ion-icon>
        {item.label}
        {#if active}
          <span
            class="absolute bottom-0 inset-x-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
          ></span>
        {/if}
      </a>
    {/each}
  </nav>

  {@render children()}
</div>
