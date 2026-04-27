<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import AdminTable from "$lib/components/AdminTable.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

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

  async function handleRoleChange(userId: string, roleId: number) {
    await fetch(`/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    invalidateAll();
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    await fetch(`/admin/users/${userId}`, { method: "DELETE" });
    invalidateAll();
  }
</script>

<MetaTags
  title="Manage Users | Count Collab"
  description="Admin user management"
  path="/admin/users"
/>

<h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6">Users</h1>

<form method="GET" class="mb-6">
  <input
    name="q"
    type="text"
    placeholder="Search users..."
    bind:value={searchQuery}
    class="w-full max-w-md rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
  />
</form>

<AdminTable
  columns={[
    { key: 'username', label: 'User', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    { key: 'actions', label: 'Actions', align: 'right' },
  ]}
  currentSort={data.sort}
  currentOrder={data.order}
  baseUrl="/admin/users"
  {extraParams}
>
  {#snippet rows()}
    {#each data.users as user (user.id)}
      <tr>
        <td class="px-4 py-3">
          <span class="font-medium text-slate-900 dark:text-slate-100"
            >{user.username ?? "—"}</span
          >
          {#if user.name}
            <span class="text-slate-500 dark:text-slate-400 ml-1">({user.name})</span>
          {/if}
        </td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-400">{user.email ?? "—"}</td>
        <td class="px-4 py-3">
          <select
            value={user.roleId ?? ""}
            onchange={(e) => {
              const val = Number((e.target as HTMLSelectElement).value);
              if (val) handleRoleChange(user.id, val);
            }}
            class="rounded border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="" disabled>No role</option>
            {#each data.allRoles as role (role.id)}
              <option value={role.id}>{role.name}</option>
            {/each}
          </select>
        </td>
        <td class="px-4 py-3 text-right">
          <button
            type="button"
            onclick={() => handleDeleteUser(user.id)}
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
  baseUrl="/admin/users"
  {extraParams}
/>
