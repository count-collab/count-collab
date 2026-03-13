<script lang="ts">
  import DashboardCard from "$lib/components/DashboardCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let isCreating = $state(false);
  let showCreateForm = $state(false);
  let createTitle = $state("");
  let createDescription = $state("");
  let createVisibility = $state<"public" | "private">("private");
  let createError = $state<string | null>(null);

  async function handleCreate() {
    if (isCreating || !createTitle.trim()) return;
    isCreating = true;
    createError = null;

    try {
      const response = await fetch("/dashboards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle,
          description: createDescription,
          visibility: createVisibility,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        createError = body.error ?? "Failed to create dashboard.";
        return;
      }

      const { id } = await response.json();
      window.location.href = `/dashboards/${id}`;
    } catch {
      createError = "Network error. Please try again.";
    } finally {
      isCreating = false;
    }
  }
</script>

<MetaTags
  title="My Dashboards | Count Collab"
  description="View and manage your dashboards."
  path="/dashboards"
/>

<div class="space-y-8">
  <header class="flex items-center justify-between">
    <h1 class="text-3xl font-bold text-slate-900">My Dashboards</h1>
    <button
      type="button"
      onclick={() => (showCreateForm = !showCreateForm)}
      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
    >
      {showCreateForm ? "Cancel" : "Create New"}
    </button>
  </header>

  {#if showCreateForm}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleCreate();
      }}
      class="bg-white rounded-lg shadow p-6 space-y-4"
    >
      <div>
        <label for="dashboard-title" class="block text-sm font-medium text-slate-700 mb-1">
          Title
        </label>
        <input
          id="dashboard-title"
          type="text"
          bind:value={createTitle}
          maxlength={200}
          required
          class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="My Dashboard"
        />
      </div>
      <div>
        <label for="dashboard-description" class="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <textarea
          id="dashboard-description"
          bind:value={createDescription}
          maxlength={1000}
          rows={2}
          class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Optional description"
        ></textarea>
      </div>
      <div>
        <label for="dashboard-visibility" class="block text-sm font-medium text-slate-700 mb-1">
          Visibility
        </label>
        <select
          id="dashboard-visibility"
          bind:value={createVisibility}
          class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </div>
      {#if createError}
        <p class="text-sm text-red-600">{createError}</p>
      {/if}
      <button
        type="submit"
        disabled={isCreating || !createTitle.trim()}
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isCreating ? "Creating..." : "Create Dashboard"}
      </button>
    </form>
  {/if}

  {#if data.dashboards.length === 0 && !showCreateForm}
    <div class="text-center py-12">
      <p class="text-slate-500 mb-4">You don't have any dashboards yet.</p>
      <button
        type="button"
        onclick={() => (showCreateForm = true)}
        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
      >
        Create your first dashboard
      </button>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {#each data.dashboards as dashboard (dashboard.id)}
        <DashboardCard {dashboard} />
      {/each}
    </div>
    <Pagination
      page={data.page}
      totalPages={data.totalPages}
      baseUrl="/dashboards"
    />
  {/if}
</div>
