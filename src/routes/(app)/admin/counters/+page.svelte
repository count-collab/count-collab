<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import AdminTable from "$lib/components/AdminTable.svelte";
  import ChangeOwnerModal from "$lib/components/ChangeOwnerModal.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import { slugify } from "$lib/counter";
  import type { Counter, CounterVisibilityMode } from "$lib/db/schema";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
  const visibilityLabels: Record<CounterVisibilityMode, string> = {
    public: "Public",
    public_readonly: "Public (read-only)",
    private: "Private",
  };
  const visibilityBadgeClasses: Record<CounterVisibilityMode, string> = {
    public: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    public_readonly: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    private: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };

  const initialQuery = $derived(data.query ?? "");
  let searchQuery = $state("");
  $effect(() => {
    searchQuery = initialQuery;
  });

  const extraParams = $derived.by(() => {
    const params: Record<string, string> = {};
    if (data.query) params.q = data.query;
    if (data.sort) params.sort = data.sort;
    if (data.order) params.order = data.order;
    return params;
  });

  function getVisibilityMode(counter: Pick<Counter, "visibilityMode" | "isPublic">): CounterVisibilityMode {
    return counter.visibilityMode ?? (counter.isPublic ? "public" : "private");
  }

  function getVisibilityLabel(counter: Pick<Counter, "visibilityMode" | "isPublic">): string {
    return visibilityLabels[getVisibilityMode(counter)];
  }

  function getVisibilityBadgeClass(counter: Pick<Counter, "visibilityMode" | "isPublic">): string {
    return visibilityBadgeClasses[getVisibilityMode(counter)];
  }

  let changeOwnerOpen = $state(false);
  let changeOwnerCounter = $state<{ id: string; title: string; ownerName: string | null } | null>(null);

  function openChangeOwner(counter: { id: string; title: string; ownerName: string | null }) {
    changeOwnerCounter = counter;
    changeOwnerOpen = true;
  }

  async function handleDelete(counterId: string) {
    if (!confirm("Are you sure you want to delete this counter?")) return;
    await fetch(`/api/counters/${counterId}`, { method: "DELETE" });
    invalidateAll();
  }
</script>

<MetaTags
  title="Manage Counters | Count Collab"
  description="Admin counter management"
  path="/admin/counters"
/>

<h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6">Counters</h1>

<form method="GET" class="mb-6">
  <input
    name="q"
    type="text"
    placeholder="Search counters..."
    bind:value={searchQuery}
    class="w-full max-w-md rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
  />
</form>

<AdminTable
  columns={[
    { key: 'title', label: 'Title', sortable: true },
    { key: 'count', label: 'Count', sortable: true },
    { key: 'actions', label: 'Actions', sortable: true },
    { key: 'visibility', label: 'Visibility', sortable: true },
    { key: 'owner', label: 'Owner', sortable: true },
    { key: 'createdAt', label: 'Created', sortable: true },
    { key: 'updatedAt', label: 'Updated', sortable: true },
    { key: 'manage', label: '', align: 'right' },
  ]}
  currentSort={data.sort}
  currentOrder={data.order}
  baseUrl="/admin/counters"
  {extraParams}
>
  {#snippet rows()}
    {#each data.counters as counter (counter.id)}
      <tr>
        <td class="px-4 py-3">
          <a
            href="/c/{counter.id}/{slugify(counter.title)}"
            class="font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {counter.title}
          </a>
        </td>
        <td class="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{counter.count}</td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{counter.actionCount}</td>
        <td class="px-4 py-3">
          <span
            class="text-xs px-2 py-0.5 rounded-full {getVisibilityBadgeClass(counter)}"
          >
            {getVisibilityLabel(counter)}
          </span>
        </td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{counter.ownerName ?? "System"}</td
        >
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400"
          >{new Date(counter.createdAt).toLocaleDateString()}</td
        >
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400"
          >{new Date(counter.updatedAt).toLocaleDateString()}</td
        >
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <a
            href="/c/{counter.id}/{slugify(counter.title)}"
            class="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm mr-3">View</a
          >
          <button
            type="button"
            onclick={() => openChangeOwner({ id: counter.id, title: counter.title, ownerName: counter.ownerName ?? null })}
            class="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm mr-3"
          >
            Change Owner
          </button>
          <button
            type="button"
            onclick={() => handleDelete(counter.id)}
            class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
          >
            Delete
          </button>
        </td>
      </tr>
    {/each}
  {/snippet}
</AdminTable>

<Pagination
  page={data.page}
  totalPages={data.totalPages}
  baseUrl="/admin/counters"
  {extraParams}
/>

{#if changeOwnerCounter}
  <ChangeOwnerModal
    bind:open={changeOwnerOpen}
    counterId={changeOwnerCounter.id}
    counterTitle={changeOwnerCounter.title}
    currentOwnerName={changeOwnerCounter.ownerName}
    onsave={() => invalidateAll()}
  />
{/if}
