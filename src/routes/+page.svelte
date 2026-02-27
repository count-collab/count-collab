<script lang="ts">
  import { browser } from "$app/environment";
  import { invalidate } from "$app/navigation";
  import { onCounterCreated, onCounterUpdated } from "$lib/stores/counters";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  $effect(() => {
    if (!browser) return;

    const unsubUpdate = onCounterUpdated(() => {
      invalidate("counters:list");
    });

    const unsubCreated = onCounterCreated(() => {
      invalidate("counters:list");
    });

    return () => {
      unsubUpdate();
      unsubCreated();
    };
  });
</script>

<svelte:head>
  <title>Count Collab - Create and Share Counters</title>
  <meta name="description" content="Create counters with unique links and share them to track anything in real-time." />
</svelte:head>

<div class="space-y-8">
  <section class="text-center py-12">
    <h1 class="text-5xl font-bold text-slate-900 mb-4">
      Welcome to Count Collab
    </h1>
    <p class="text-xl text-slate-600 mb-8">
      Create and share counters that anyone can increment and follow in
      real-time.
    </p>
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

  <section class="grid md:grid-cols-3 gap-6">
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-slate-900 mb-2">
        📊 Easy Tracking
      </h3>
      <p class="text-slate-600">
        Create counters with titles and descriptions. Track anything you want.
      </p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-slate-900 mb-2">🔗 Shareable</h3>
      <p class="text-slate-600">
        Share counters directly with unique links. No login required.
      </p>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-slate-900 mb-2">⚡ Real-time</h3>
      <p class="text-slate-600">
        See updates instantly as others interact with your counters.
      </p>
    </div>
  </section>

  {#if data.popularCounters && data.popularCounters.length > 0}
    <section class="bg-white rounded-lg shadow p-8">
      <h2 class="text-2xl font-bold text-slate-900 mb-6">Popular Counters</h2>
      <div class="grid gap-4">
        {#each data.popularCounters as counter (counter.id)}
          <a
            href={`/c/${counter.id}`}
            class="block border border-slate-200 rounded p-4 hover:border-blue-400 transition"
          >
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-semibold text-slate-900">{counter.title}</h3>
                {#if counter.description}
                  <p class="text-sm text-slate-600">{counter.description}</p>
                {/if}
              </div>
              <div class="text-3xl font-bold text-blue-600">
                {counter.count}
              </div>
            </div>
          </a>
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
