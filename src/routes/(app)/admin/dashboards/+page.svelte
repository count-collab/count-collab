<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import type { DashboardVisibilityMode } from "$lib/db/schema";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const visibilityLabels: Record<DashboardVisibilityMode, string> = {
    public: "Public",
    private: "Private",
  };
  const visibilityBadgeClasses: Record<DashboardVisibilityMode, string> = {
    public: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    private: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };

  const initialQuery = $derived(data.query ?? "");
  let searchQuery = $state("");
  $effect(() => {
    searchQuery = initialQuery;
  });

  async function handleDelete(dashboardId: string) {
    if (!confirm("Are you sure you want to delete this dashboard?")) return;
    await fetch(`/api/dashboards/${dashboardId}`, { method: "DELETE" });
    invalidateAll();
  }
</script>

<MetaTags
  title="Manage Dashboards | Count Collab"
  description="Admin dashboard management"
  path="/admin/dashboards"
/>

<h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6">Dashboards</h1>

<form method="GET" class="mb-6">
  <input
    name="q"
    type="text"
    placeholder="Search dashboards..."
    bind:value={searchQuery}
    class="w-full max-w-md rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
  />
</form>

<div class="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 overflow-x-auto">
  <table class="w-full text-sm min-w-[600px]">
    <thead class="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <tr>
        <th class="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Title</th>
        <th class="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
          >Visibility</th
        >
        <th class="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Owner</th>
        <th class="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
          >Created</th
        >
        <th class="text-right px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
          >Actions</th
        >
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
      {#each data.dashboards as dashboard (dashboard.id)}
        <tr>
          <td class="px-4 py-3">
            <a
              href="/d/{dashboard.id}"
              class="font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {dashboard.title}
            </a>
          </td>
          <td class="px-4 py-3">
            <span
              class="text-xs px-2 py-0.5 rounded-full {visibilityBadgeClasses[dashboard.visibilityMode]}"
            >
              {visibilityLabels[dashboard.visibilityMode]}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400"
            >{dashboard.ownerName ?? "System"}</td
          >
          <td class="px-4 py-3 text-slate-600 dark:text-slate-400"
            >{new Date(dashboard.createdAt).toLocaleDateString()}</td
          >
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <a
              href="/d/{dashboard.id}"
              class="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm mr-3"
              >View</a
            >
            <button
              type="button"
              onclick={() => handleDelete(dashboard.id)}
              class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
            >
              Delete
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<Pagination
  page={data.page}
  totalPages={data.totalPages}
  baseUrl="/admin/dashboards"
  extraParams={data.query ? { q: data.query } : {}}
/>
