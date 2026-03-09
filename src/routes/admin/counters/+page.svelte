<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let searchQuery = $state(data.query ?? "");

  async function handleDelete(counterId: string) {
    if (!confirm("Are you sure you want to delete this counter?")) return;
    await fetch(`/c/${counterId}`, { method: "DELETE" });
    invalidateAll();
  }
</script>

<MetaTags
  title="Manage Counters | Count Collab"
  description="Admin counter management"
  path="/admin/counters"
/>

<h1 class="text-3xl font-bold text-slate-900 mb-6">Counters</h1>

<form method="GET" class="mb-6">
  <input
    name="q"
    type="text"
    placeholder="Search counters..."
    bind:value={searchQuery}
    class="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
  />
</form>

<div class="bg-white rounded-lg shadow overflow-hidden">
  <table class="w-full text-sm">
    <thead class="bg-slate-50 border-b border-slate-200">
      <tr>
        <th class="text-left px-4 py-3 font-semibold text-slate-700">Title</th>
        <th class="text-left px-4 py-3 font-semibold text-slate-700">Count</th>
        <th class="text-left px-4 py-3 font-semibold text-slate-700"
          >Visibility</th
        >
        <th class="text-left px-4 py-3 font-semibold text-slate-700">Owner</th>
        <th class="text-right px-4 py-3 font-semibold text-slate-700"
          >Actions</th
        >
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-200">
      {#each data.counters as counter (counter.id)}
        <tr>
          <td class="px-4 py-3">
            <a
              href="/c/{counter.id}"
              class="font-medium text-blue-600 hover:underline"
            >
              {counter.title}
            </a>
          </td>
          <td class="px-4 py-3 font-bold text-slate-900">{counter.count}</td>
          <td class="px-4 py-3">
            <span
              class="text-xs px-2 py-0.5 rounded-full {counter.isPublic
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600'}"
            >
              {counter.isPublic ? "Public" : "Private"}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-600">{counter.ownerId ?? "System"}</td
          >
          <td class="px-4 py-3 text-right">
            <a
              href="/c/{counter.id}"
              class="text-slate-600 hover:text-slate-800 text-sm mr-3">View</a
            >
            <button
              type="button"
              onclick={() => handleDelete(counter.id)}
              class="text-red-600 hover:text-red-800 text-sm"
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
  baseUrl="/admin/counters"
  extraParams={data.query ? { q: data.query } : {}}
/>
