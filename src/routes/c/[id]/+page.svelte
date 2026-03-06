<script lang="ts">
  import { browser } from "$app/environment";
  import { invalidate } from "$app/navigation";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { onCounterUpdated } from "$lib/stores/counters";
  import { rateLimit } from "$lib/stores/ratelimit";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let optimisticCount = $state<number | null>(null);
  let optimisticUpdatedAt = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  let isIncrementing = $state(false);

  const displayCount = $derived(optimisticCount ?? data.counter.count);
  const displayUpdatedAt = $derived(
    optimisticUpdatedAt ?? data.counter.updatedAt,
  );

  async function handleIncrement() {
    if (isIncrementing) return;
    isIncrementing = true;
    errorMessage = null;

    try {
      const response = await fetch(`/c/${data.counter.id}`, { method: "POST" });

      if (!response.ok) {
        const body = await response.json();

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = body.retryAfterSeconds ?? 60;
          rateLimit.setLimit(`/c/${data.counter.id}`, retryAfter);
          errorMessage = `Too many requests. Please try again in ${retryAfter} seconds.`;
          return;
        }

        errorMessage = body.error ?? "Failed to increment counter.";
        return;
      }

      const result: { count: number; updatedAt: string } =
        await response.json();
      optimisticCount = result.count;
      optimisticUpdatedAt = result.updatedAt;
      rateLimit.reset();
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      isIncrementing = false;
    }
  }

  $effect(() => {
    if (!browser) return;

    const unsubscribe = onCounterUpdated((payload) => {
      if (payload.counterId !== data.counter.id) return;

      invalidate(`counter:${data.counter.id}`).then(() => {
        optimisticCount = null;
        optimisticUpdatedAt = null;
      });
    });

    return unsubscribe;
  });
</script>

<MetaTags
  title={data.title}
  description={data.description}
  path="/c/{data.counter.id}"
/>

<div class="space-y-8">
  <header class="space-y-2">
    <p class="text-sm uppercase tracking-wide text-slate-500">
      {data.counter.isPublic ? "Public counter" : "Private counter"}
    </p>
    <h1 class="text-4xl font-bold text-slate-900">{data.counter.title}</h1>
    {#if data.counter.description}
      <p class="text-lg text-slate-600">{data.counter.description}</p>
    {/if}
    <p class="text-sm text-slate-500">Shareable link: /c/{data.counter.id}</p>
  </header>

  <section class="grid gap-6 lg:grid-cols-[2fr,1fr]">
    <div class="bg-white rounded-lg shadow p-6 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-slate-500">Current count</p>
          <p class="text-5xl font-bold text-blue-600">{displayCount}</p>
        </div>
        <button
          type="button"
          onclick={handleIncrement}
          disabled={isIncrementing || $rateLimit.isLimited}
          class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if $rateLimit.isLimited}
            {$rateLimit.retryAfterSeconds}s
          {:else}
            +1
          {/if}
        </button>
      </div>
      <p class="text-sm text-slate-500">
        Last updated: {new Date(displayUpdatedAt).toLocaleString()}
      </p>
      {#if errorMessage}
        <p class="text-sm text-red-600">{errorMessage}</p>
      {/if}
    </div>

    <aside class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold text-slate-900 mb-4">Recent updates</h2>
      {#if data.history.length === 0}
        <p class="text-sm text-slate-500">No updates yet.</p>
      {:else}
        <ol class="space-y-3">
          {#each data.history as entry (entry.id)}
            <li class="text-sm text-slate-600">
              {entry.previousValue} → {entry.newValue}
              <span class="text-xs text-slate-400">
                ({new Date(entry.changedAt).toLocaleTimeString()})
              </span>
            </li>
          {/each}
        </ol>
      {/if}
    </aside>
  </section>
</div>
