<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import AdminTable from "$lib/components/AdminTable.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { slugify } from "$lib/counter";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const user = $derived(data.detail.user);

  const stats = $derived([
    {
      label: "Total Actions",
      value: data.detail.actionCount,
      icon: "flash-outline",
      accent: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
    },
    {
      label: "Counters Owned",
      value: data.detail.ownedCounters.length,
      icon: "trending-up-outline",
      accent: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    },
    {
      label: "Dashboards Owned",
      value: data.detail.ownedDashboards.length,
      icon: "grid-outline",
      accent: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
    },
  ]);

  const visibilityBadges: Record<string, { class: string; label: string }> = {
    public: {
      class: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      label: "Public",
    },
    public_readonly: {
      class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      label: "Public (read-only)",
    },
    private: {
      class: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
      label: "Private",
    },
  };

  function getBadge(mode: string) {
    return visibilityBadges[mode] ?? visibilityBadges.private;
  }

  function getInitials(name: string | null, username: string | null): string {
    const source = name || username || "?";
    return source
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

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
    goto("/admin/users");
  }
</script>

<MetaTags
  title="User: {user.username ?? user.name ?? 'Unknown'} | Count Collab"
  description="Admin user detail"
  path="/admin/users/{user.id}"
/>

<div class="space-y-8">
  <!-- Back link -->
  <a
    href="/admin/users"
    class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
  >
    <ion-icon name="arrow-back-outline" style="font-size: 16px;"></ion-icon>
    Back to Users
  </a>

  <!-- User header card -->
  <div
    class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
  >
    <div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex items-start gap-4">
        {#if user.image}
          <img
            src={user.image}
            alt="{user.username ?? user.name ?? 'User'} avatar"
            class="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        {:else}
          <div
            class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xl font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            {getInitials(user.name, user.username)}
          </div>
        {/if}
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {user.username ?? "—"}
          </h1>
          {#if user.name}
            <p class="text-sm text-slate-500 dark:text-slate-400">{user.name}</p>
          {/if}
          {#if user.email}
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
          {/if}
          <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Joined {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
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
        <button
          type="button"
          onclick={() => handleDeleteUser(user.id)}
          class="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
        >
          Delete
        </button>
      </div>
    </div>
  </div>

  <!-- Stats row -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each stats as stat (stat.label)}
      <div
        class="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
            <p class="mt-2 text-3xl font-bold tabular-nums {stat.accent}">
              {stat.value.toLocaleString()}
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

  <!-- Counters table -->
  <div class="space-y-3">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Counters</h2>
    {#if data.detail.ownedCounters.length === 0}
      <p class="text-sm text-slate-500 dark:text-slate-400">No counters</p>
    {:else}
      <AdminTable
        columns={[
          { key: "title", label: "Title" },
          { key: "count", label: "Count", align: "right" },
          { key: "actions", label: "Actions", align: "right" },
          { key: "visibility", label: "Visibility" },
          { key: "createdAt", label: "Created" },
          { key: "updatedAt", label: "Updated" },
        ]}
        baseUrl="/admin/users/{user.id}"
      >
        {#snippet rows()}
          {#each data.detail.ownedCounters as counter (counter.id)}
            <tr>
              <td class="px-4 py-3">
                <a
                  href="/c/{counter.id}/{slugify(counter.title)}"
                  class="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {counter.title}
                </a>
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {counter.count.toLocaleString()}
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {counter.actionCount.toLocaleString()}
              </td>
              <td class="px-4 py-3">
                <span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {getBadge(counter.visibilityMode).class}">
                  {getBadge(counter.visibilityMode).label}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">
                {new Date(counter.createdAt).toLocaleDateString()}
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">
                {new Date(counter.updatedAt).toLocaleDateString()}
              </td>
            </tr>
          {/each}
        {/snippet}
      </AdminTable>
    {/if}
  </div>

  <!-- Dashboards table -->
  <div class="space-y-3">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Dashboards</h2>
    {#if data.detail.ownedDashboards.length === 0}
      <p class="text-sm text-slate-500 dark:text-slate-400">No dashboards</p>
    {:else}
      <AdminTable
        columns={[
          { key: "title", label: "Title" },
          { key: "visibility", label: "Visibility" },
          { key: "createdAt", label: "Created" },
          { key: "updatedAt", label: "Updated" },
        ]}
        baseUrl="/admin/users/{user.id}"
      >
        {#snippet rows()}
          {#each data.detail.ownedDashboards as dashboard (dashboard.id)}
            <tr>
              <td class="px-4 py-3">
                <a
                  href="/d/{dashboard.id}"
                  class="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {dashboard.title}
                </a>
              </td>
              <td class="px-4 py-3">
                <span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {getBadge(dashboard.visibilityMode).class}">
                  {getBadge(dashboard.visibilityMode).label}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">
                {new Date(dashboard.createdAt).toLocaleDateString()}
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-400">
                {new Date(dashboard.updatedAt).toLocaleDateString()}
              </td>
            </tr>
          {/each}
        {/snippet}
      </AdminTable>
    {/if}
  </div>
</div>
