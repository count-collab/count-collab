<script lang="ts">
  import { browser } from "$app/environment";
  import { invalidate } from "$app/navigation";
  import CounterCard from "$lib/components/CounterCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { onCounterCreated, onCounterUpdated } from "$lib/stores/counters";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  $effect(() => {
    if (!browser) return;

    const unsubUpdate = onCounterUpdated(() => {
      invalidate("counters:list");
      invalidate("counters:user");
    });

    const unsubCreated = onCounterCreated(() => {
      invalidate("counters:list");
      invalidate("counters:user");
    });

    return () => {
      unsubUpdate();
      unsubCreated();
    };
  });
</script>

<MetaTags
  title="Count Collab - Create and Share Counters"
  description="Create counters with unique links and share them to track anything in real-time."
  path="/"
/>

<div class="space-y-8">
  <section class="text-center py-8">
    <h1 class="text-4xl font-bold text-slate-900 mb-6">
      Welcome to Count Collab
    </h1>
    <div class="flex gap-4 justify-center">
      <a
        href="/create"
        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
      >
        Create Counter
      </a>
      <a
        href="/counters"
        class="px-6 py-3 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition font-semibold"
      >
        Browse Counters
      </a>
    </div>
  </section>

  {#if data.userCounters.length > 0}
    <!-- Logged-in: side-by-side layout -->
    <div class="grid md:grid-cols-2 gap-8">
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-slate-900">Your Counters</h2>
          <a
            href="/my-counters"
            class="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View all &rarr;
          </a>
        </div>
        <div class="grid grid-cols-2 gap-3">
          {#each data.userCounters.slice(0, 6) as counter (counter.id)}
            <CounterCard {counter} showBadges />
          {/each}
        </div>
      </section>

      <section>
        <h2 class="text-2xl font-bold text-slate-900 mb-4">Popular Counters</h2>
        {#if data.popularCounters.length > 0}
          <div class="grid grid-cols-2 gap-3">
            {#each data.popularCounters.slice(0, 6) as counter (counter.id)}
              <CounterCard {counter} />
            {/each}
          </div>
        {:else}
          <p class="text-slate-500 text-center py-8">No public counters yet.</p>
        {/if}
      </section>
    </div>
  {:else if data.popularCounters.length > 0}
    <!-- Guest or user with no counters -->
    <section>
      <h2 class="text-2xl font-bold text-slate-900 mb-4">Popular Counters</h2>
      <div
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {#each data.popularCounters as counter (counter.id)}
          <CounterCard {counter} />
        {/each}
      </div>
    </section>
  {:else}
    <section class="bg-white rounded-lg shadow p-8 text-center text-slate-600">
      No counters yet. <a href="/create" class="text-blue-600"
        >Create the first one</a
      >.
    </section>
  {/if}
</div>
