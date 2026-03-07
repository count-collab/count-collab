<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<MetaTags
  title="My Counters | Count Collab"
  description="View and manage your counters."
  path="/my-counters"
/>

<div class="space-y-8">
  <header class="flex items-center justify-between">
    <h1 class="text-3xl font-bold text-slate-900">My Counters</h1>
    <a
      href="/create"
      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
    >
      Create New
    </a>
  </header>

  {#if data.counters.length === 0}
    <div class="text-center py-12">
      <p class="text-slate-500 mb-4">You don't have any counters yet.</p>
      <a
        href="/create"
        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
      >
        Create your first counter
      </a>
    </div>
  {:else}
    <div class="grid gap-4">
      {#each data.counters as counter (counter.id)}
        <a
          href={`/c/${counter.id}`}
          class="block bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-400 transition shadow-sm"
        >
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-semibold text-slate-900">{counter.title}</h3>
              {#if counter.description}
                <p class="text-sm text-slate-600 mt-1">{counter.description}</p>
              {/if}
              <div class="flex gap-2 mt-2">
                <span
                  class="text-xs px-2 py-0.5 rounded-full {counter.isPublic
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-600'}"
                >
                  {counter.isPublic ? "Public" : "Private"}
                </span>
                {#if counter.ownerId}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"
                    >Owned</span
                  >
                {:else}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                    >Shared</span
                  >
                {/if}
              </div>
            </div>
            <div class="text-3xl font-bold text-blue-600">{counter.count}</div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
