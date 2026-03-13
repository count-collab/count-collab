<script lang="ts">
  import type { Dashboard } from "$lib/db/schema";

  type Props = {
    counterId: string;
    dashboards: Dashboard[];
    dashboardIdsWithCounter: string[];
    onclose: () => void;
  };

  const { counterId, dashboards, dashboardIdsWithCounter, onclose }: Props = $props();

  let activeIds = $state<string[]>([...dashboardIdsWithCounter]);
  let addingTo = $state<string | null>(null);
  let removingFrom = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);

  async function handleAdd(dashboardId: string) {
    addingTo = dashboardId;
    errorMessage = null;

    try {
      const response = await fetch(`/dashboards/${dashboardId}/counters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterId }),
      });

      if (!response.ok) {
        const body = await response.json();
        errorMessage = body.error ?? "Failed to add counter.";
        return;
      }

      activeIds = [...activeIds, dashboardId];
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      addingTo = null;
    }
  }

  async function handleRemove(dashboardId: string) {
    removingFrom = dashboardId;
    errorMessage = null;

    try {
      const response = await fetch(`/dashboards/${dashboardId}/counters`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterId }),
      });

      if (!response.ok) {
        const body = await response.json();
        errorMessage = body.error ?? "Failed to remove counter.";
        return;
      }

      activeIds = activeIds.filter((id) => id !== dashboardId);
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      removingFrom = null;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Add to dashboard">
  <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-900">Add to Dashboard</h2>
      <button type="button" onclick={onclose} class="text-slate-400 hover:text-slate-600" aria-label="Close">
        <ion-icon name="close-outline" style="font-size: 20px;"></ion-icon>
      </button>
    </div>

    {#if dashboards.length === 0}
      <div class="text-center py-4">
        <p class="text-slate-500 text-sm mb-2">You don't have any dashboards yet.</p>
        <a href="/dashboards" class="text-sm text-blue-600 hover:text-blue-700 font-medium">
          Create a dashboard &rarr;
        </a>
      </div>
    {:else}
      {#if errorMessage}
        <p class="text-sm text-red-600">{errorMessage}</p>
      {/if}
      <ul class="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {#each dashboards as dashboard (dashboard.id)}
          {@const isOnDashboard = activeIds.includes(dashboard.id)}
          <li class="flex items-center justify-between py-2.5">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="text-sm font-medium text-slate-900 truncate">{dashboard.title}</span>
              {#if dashboard.isMain}
                <span class="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">Main</span>
              {/if}
            </div>
            {#if isOnDashboard}
              <button
                type="button"
                onclick={() => handleRemove(dashboard.id)}
                disabled={removingFrom === dashboard.id}
                class="shrink-0 ml-2 px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 transition disabled:opacity-50"
              >
                {removingFrom === dashboard.id ? "..." : "Remove"}
              </button>
            {:else}
              <button
                type="button"
                onclick={() => handleAdd(dashboard.id)}
                disabled={addingTo === dashboard.id}
                class="shrink-0 ml-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
              >
                {addingTo === dashboard.id ? "..." : "Add"}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
