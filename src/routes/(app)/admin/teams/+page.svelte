<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import AdminTable from "$lib/components/AdminTable.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  type Team = PageData["teams"][number];

  const initialQuery = $derived(data.query ?? "");
  let searchQuery = $state("");
  $effect(() => {
    searchQuery = initialQuery;
  });

  const extraParams = $derived.by(() => {
    const params: Record<string, string> = {};
    if (data.query) params.q = data.query;
    return params;
  });

  let deleteTarget = $state<Team | null>(null);
  let deleteOpen = $state(false);
  let confirmName = $state("");
  let isDeleting = $state(false);
  let deleteError = $state<string | null>(null);

  const canConfirm = $derived(
    deleteTarget !== null && confirmName === deleteTarget.name && !isDeleting,
  );

  function pluralize(count: number, singular: string): string {
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
  }

  function openDelete(team: Team) {
    deleteTarget = team;
    confirmName = "";
    deleteError = null;
    deleteOpen = true;
  }

  function closeDelete() {
    deleteOpen = false;
    deleteTarget = null;
    confirmName = "";
    deleteError = null;
  }

  async function handleDelete(event: SubmitEvent) {
    event.preventDefault();
    if (!deleteTarget || !canConfirm) return;

    isDeleting = true;
    deleteError = null;
    try {
      const response = await fetch(`/api/teams/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        deleteError = err.error ?? "Failed to delete team";
        return;
      }

      closeDelete();
      await invalidateAll();
    } catch {
      deleteError = "Failed to delete team";
    } finally {
      isDeleting = false;
    }
  }
</script>

<MetaTags
  title="Manage Teams | Count Collab"
  description="Admin team management"
  path="/admin/teams"
/>

<h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6">Teams</h1>

<form method="GET" class="mb-6">
  <input
    name="q"
    type="text"
    placeholder="Search teams..."
    aria-label="Search teams"
    bind:value={searchQuery}
    class="w-full max-w-md rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
  />
</form>

<AdminTable
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'members', label: 'Members' },
    { key: 'counters', label: 'Counters' },
    { key: 'dashboards', label: 'Dashboards' },
    { key: 'createdAt', label: 'Created' },
    { key: 'updatedAt', label: 'Updated' },
    { key: 'manage', label: '', align: 'right' },
  ]}
  baseUrl="/admin/teams"
  {extraParams}
>
  {#snippet rows()}
    {#each data.teams as team (team.id)}
      <tr>
        <td class="px-4 py-3">
          <a
            href="/t/{team.id}"
            class="font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {team.name}
          </a>
        </td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400 tabular-nums"
          >{team.memberCount}</td
        >
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400 tabular-nums"
          >{team.counterCount}</td
        >
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400 tabular-nums"
          >{team.dashboardCount}</td
        >
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400"
          >{new Date(team.createdAt).toLocaleDateString()}</td
        >
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400"
          >{new Date(team.updatedAt).toLocaleDateString()}</td
        >
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <a
            href="/t/{team.id}"
            class="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm mr-3"
            >View</a
          >
          <button
            type="button"
            onclick={() => openDelete(team)}
            aria-label="Delete team {team.name}"
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
  baseUrl="/admin/teams"
  {extraParams}
/>

<Modal
  bind:open={deleteOpen}
  title="Delete team"
  describedBy="delete-team-description"
  onclose={closeDelete}
>
  {#if deleteTarget}
    <form onsubmit={handleDelete} class="space-y-4">
      <p
        id="delete-team-description"
        class="text-sm text-slate-600 dark:text-slate-400"
      >
        Deleting <strong class="text-slate-900 dark:text-slate-100"
          >{deleteTarget.name}</strong
        >
        will permanently delete {pluralize(deleteTarget.counterCount, "counter")}
        and {pluralize(deleteTarget.dashboardCount, "dashboard")}. This cannot be
        undone.
      </p>

      <div class="space-y-1">
        <label
          for="delete-team-confirm"
          class="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Type <span class="font-mono">{deleteTarget.name}</span> to confirm
        </label>
        <input
          id="delete-team-confirm"
          type="text"
          autocomplete="off"
          bind:value={confirmName}
          aria-invalid={deleteError ? "true" : undefined}
          aria-describedby={deleteError ? "delete-team-error" : undefined}
          class="w-full rounded-md border border-slate-300 bg-white text-slate-900 dark:border-slate-600 px-3 py-2 focus:border-red-500 dark:focus:border-red-400 focus:outline-none dark:bg-slate-700 dark:text-slate-100"
        />
      </div>

      {#if deleteError}
        <p
          id="delete-team-error"
          role="alert"
          class="text-sm text-red-600 dark:text-red-400"
        >
          {deleteError}
        </p>
      {/if}

      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={closeDelete}
          class="rounded-md px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canConfirm}
          class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? "Deleting…" : "Delete team"}
        </button>
      </div>
    </form>
  {/if}
</Modal>
