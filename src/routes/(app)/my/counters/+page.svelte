<script lang="ts">
  import CounterCard from "$lib/components/CounterCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<MetaTags
  title="My Counters | Count Collab"
  description="All your counters — owned, shared, and followed."
  path="/my/counters"
/>

<div class="space-y-10">
  <!-- Owned counters -->
  <section>
    <div class="flex items-center gap-2 mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Owned</h2>
      <span
        class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"
      >
        {data.ownedCounters.total}
      </span>
    </div>
    {#if data.ownedCounters.items.length === 0}
      <div
        class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
      >
        <ion-icon
          name="pulse-outline"
          class="text-slate-300 dark:text-slate-600"
          style="font-size: 40px;"
        ></ion-icon>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Create your first counter
        </p>
        <a
          href="/create?type=counter"
          class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ion-icon name="add-circle-outline" style="font-size: 16px;"></ion-icon>
          Get started
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each data.ownedCounters.items as counter (counter.id)}
          <CounterCard {counter} showBadges />
        {/each}
      </div>
      <div class="mt-6">
        <Pagination page={data.page} totalPages={data.totalPages} baseUrl="/my/counters" />
      </div>
    {/if}
  </section>

  <!-- Shared with me -->
  <section>
    <div class="flex items-center gap-2 mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Shared with me</h2>
      <span
        class="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300"
      >
        {data.sharedCounters.total}
      </span>
    </div>
    {#if data.sharedCounters.items.length === 0}
      <div
        class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
      >
        <ion-icon
          name="people-outline"
          class="text-slate-300 dark:text-slate-600"
          style="font-size: 40px;"
        ></ion-icon>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No one has shared a counter with you yet
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each data.sharedCounters.items as counter (counter.id)}
          <CounterCard {counter} showBadges />
        {/each}
      </div>
    {/if}
  </section>

  <!-- Following -->
  <section>
    <div class="flex items-center gap-2 mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Following</h2>
      <span
        class="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400"
      >
        {data.followedCounters.length}
      </span>
    </div>
    {#if data.followedCounters.length === 0}
      <div
        class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
      >
        <ion-icon
          name="heart-outline"
          class="text-slate-300 dark:text-slate-600"
          style="font-size: 40px;"
        ></ion-icon>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You're not following any counters yet.
        </p>
        <a
          href="/counters"
          class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Discover counters to follow
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each data.followedCounters as counter (counter.id)}
          <CounterCard {counter} showBadges followed />
        {/each}
      </div>
    {/if}
  </section>
</div>
