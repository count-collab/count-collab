<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let searchQuery = $state(data.query ?? "");

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

<h1 class="text-3xl font-bold text-slate-900 mb-6">Users</h1>

<form method="GET" class="mb-6">
  <input
    name="q"
    type="text"
    placeholder="Search users..."
    bind:value={searchQuery}
    class="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
  />
</form>

<div class="bg-white rounded-lg shadow overflow-hidden">
  <table class="w-full text-sm">
    <thead class="bg-slate-50 border-b border-slate-200">
      <tr>
        <th class="text-left px-4 py-3 font-semibold text-slate-700">User</th>
        <th class="text-left px-4 py-3 font-semibold text-slate-700">Email</th>
        <th class="text-left px-4 py-3 font-semibold text-slate-700">Role</th>
        <th class="text-right px-4 py-3 font-semibold text-slate-700"
          >Actions</th
        >
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-200">
      {#each data.users as user (user.id)}
        <tr>
          <td class="px-4 py-3">
            <span class="font-medium text-slate-900"
              >{user.username ?? "—"}</span
            >
            {#if user.name}
              <span class="text-slate-500 ml-1">({user.name})</span>
            {/if}
          </td>
          <td class="px-4 py-3 text-slate-600">{user.email ?? "—"}</td>
          <td class="px-4 py-3">
            <select
              value={user.roleId ?? ""}
              onchange={(e) => {
                const val = Number((e.target as HTMLSelectElement).value);
                if (val) handleRoleChange(user.id, val);
              }}
              class="rounded border border-slate-300 px-2 py-1 text-sm"
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
