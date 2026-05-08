<script lang="ts">
  import { browser } from "$app/environment";
  import { invalidate } from "$app/navigation";
  import CounterCard from "$lib/components/CounterCard.svelte";
  import DashboardCard from "$lib/components/DashboardCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import RollingNumber from "$lib/components/RollingNumber.svelte";
  import { onCounterCreated, onCounterUpdated } from "$lib/stores/counters";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  // Merge owned/shared + followed counters, deduplicate, sort by count desc
  const allMyCounters = $derived.by(() => {
    const ownedIds = new Set(data.userCounters.map((c) => c.id));
    const followed = data.followedCounters.filter((c) => !ownedIds.has(c.id));
    const merged = [
      ...data.userCounters.map((c) => ({ counter: c, followed: false })),
      ...followed.map((c) => ({ counter: c, followed: true })),
    ];
    merged.sort((a, b) => b.counter.count - a.counter.count);
    return merged.slice(0, 12);
  });

  // Merge owned/shared + followed dashboards, deduplicate
  const allMyDashboards = $derived.by(() => {
    const ownedIds = new Set(data.userDashboards.map((d) => d.id));
    const followed = data.followedDashboards.filter((d) => !ownedIds.has(d.id));
    return [
      ...data.userDashboards.map((d) => ({ dashboard: d, followed: false })),
      ...followed.map((d) => ({ dashboard: d, followed: true })),
    ].slice(0, 12);
  });

  const popularSlice = $derived(data.popularCounters.slice(0, 12));

  let scrollY = $state(0);
  let heroEl: HTMLElement | undefined = $state();
  let heroHeight = $state(600);

  // Scroll progress 0→1 as hero scrolls out of view
  const scrollProgress = $derived(Math.min(scrollY / heroHeight, 1));

  $effect(() => {
    if (!browser || !heroEl) return;
    heroHeight = heroEl.offsetHeight;
  });

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
  path="/home"
/>

<svelte:window bind:scrollY />

<div class="relative pb-16">
  <!-- Page-wide background orbs with ambient drift + scroll parallax -->
  <div
    class="pointer-events-none absolute top-0 left-0 h-[500px] w-[500px] rounded-full bg-blue-400/20 dark:bg-blue-500/10 blur-[120px] animate-orb-drift-1"
    style="translate: 0 {scrollY * 0.15}px"
    aria-hidden="true"
  ></div>
  <div
    class="pointer-events-none absolute top-[40%] right-0 h-[400px] w-[400px] rounded-full bg-indigo-400/15 dark:bg-indigo-500/10 blur-[120px] animate-orb-drift-2"
    style="translate: 0 {scrollY * -0.1}px"
    aria-hidden="true"
  ></div>

  <section
    bind:this={heroEl}
    class="full-bleed text-center flex flex-col items-center justify-center px-4 -mt-8 pt-20 pb-12 lg:pt-22 lg:pb-14"
  >
    <div
      class="flex flex-col items-center"
      style="opacity: {1 -
        scrollProgress * 0.6}; transform: translateY({scrollY * 0.25}px)"
    >
      <h1
        class="hero-stagger text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight"
        style="animation-delay: 50ms"
      >
        Count together,
        <span
          class="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent"
        >
          in real time
        </span>
      </h1>
      <div
        class="hero-stagger mt-8 flex flex-col items-center gap-1"
        style="animation-delay: 100ms"
      >
        <p
          class="text-5xl sm:text-7xl font-extrabold text-blue-600 dark:text-blue-400"
        >
          <RollingNumber value={data.globalSum} />
        </p>
        <p
          class="text-base text-slate-500 dark:text-slate-400 text-center inline-flex items-center justify-center gap-1 w-full"
        >
          across <span class="font-semibold inline-flex items-center"
            ><RollingNumber value={data.counterCount} /></span
          > counters
        </p>
      </div>

      <div
        class="hero-stagger mt-8 flex flex-wrap gap-4 justify-center"
        style="animation-delay: 200ms"
      >
        <a
          href="/create?type=counter"
          class="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Create Counter
          <span
            class="inline-block transition-transform group-hover:translate-x-0.5"
            >&rarr;</span
          >
        </a>
        <a
          href="/counters"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-7 py-3.5 font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          Browse Counters
        </a>
      </div>
    </div>
  </section>

  {#if allMyCounters.length > 0}
    <section aria-labelledby="your-counters-heading" class="relative z-10">
      <div class="mb-6">
        <div class="flex items-center gap-4">
          <h2
            id="your-counters-heading"
            class="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
          >
            <ion-icon
              name="person-outline"
              style="font-size: 28px;"
              aria-hidden="true"
            ></ion-icon>
            My Counters
          </h2>
          <a
            href="/my/counters"
            class="group flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
          >
            All my counters
            <span
              class="inline-block transition-transform group-hover:translate-x-0.5"
              >&rarr;</span
            >
          </a>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Counters you own or follow</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {#each allMyCounters as { counter, followed }, i (counter.id)}
          <div class="animate-fade-up" style="animation-delay: {i * 60}ms">
            <CounterCard {counter} showBadges {followed} />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if allMyDashboards.length > 0}
    <section
      aria-labelledby="your-dashboards-heading"
      class="relative z-10 mt-16"
    >
      <div class="mb-6">
        <div class="flex items-center gap-4">
          <h2
            id="your-dashboards-heading"
            class="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
          >
            <ion-icon
              name="grid-outline"
              style="font-size: 28px;"
              aria-hidden="true"
            ></ion-icon>
            My Dashboards
          </h2>
          <a
            href="/my/dashboards"
            class="group flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
          >
            All my dashboards
            <span
              class="inline-block transition-transform group-hover:translate-x-0.5"
              >&rarr;</span
            >
          </a>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Your dashboard collections</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {#each allMyDashboards as { dashboard, followed }, i (dashboard.id)}
          <div class="animate-fade-up" style="animation-delay: {i * 60}ms">
            <DashboardCard {dashboard} showBadges {followed} />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if data.popularCounters.length > 0}
    <section
      aria-labelledby="popular-counters-heading"
      class="relative z-10 mt-16 border-t border-slate-200 dark:border-slate-700 pt-10"
    >
      <div class="flex items-center gap-3 mb-6">
        <h2
          id="popular-counters-heading"
          class="text-lg font-semibold text-slate-600 dark:text-slate-400"
        >
          Popular Counters
        </h2>
        <a
          href="/counters"
          class="group flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          Explore popular
          <span
            class="inline-block transition-transform group-hover:translate-x-0.5"
            >&rarr;</span
          >
        </a>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {#each popularSlice as counter, i (counter.id)}
          <div class="animate-fade-up" style="animation-delay: {i * 60}ms">
            <CounterCard {counter} />
          </div>
        {/each}
      </div>
    </section>
  {:else if allMyCounters.length === 0 && allMyDashboards.length === 0}
    <section
      class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/60 dark:bg-slate-800/60 p-12 text-center"
    >
      <div
        class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900"
      >
        <ion-icon
          name="add-circle-outline"
          style="font-size: 32px; color: rgb(37 99 235);"
          aria-hidden="true"
        ></ion-icon>
      </div>
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        No counters yet
      </h3>
      <p class="mt-1 text-slate-500 dark:text-slate-400">
        Be the first to create one and start counting together.
      </p>
      <a
        href="/create?type=counter"
        class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Create Counter
      </a>
    </section>
  {/if}

  {#if data.recentlyCreated.length > 0}
    <section
      aria-labelledby="recently-created-heading"
      class="relative z-10 mt-16 border-t border-slate-200 dark:border-slate-700 pt-10"
    >
      <div class="flex items-center gap-3 mb-6">
        <h2
          id="recently-created-heading"
          class="text-lg font-semibold text-slate-600 dark:text-slate-400"
        >
          Recently Created
        </h2>
        <a
          href="/counters?sort=newest"
          class="group flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          See newest
          <span
            class="inline-block transition-transform group-hover:translate-x-0.5"
            >&rarr;</span
          >
        </a>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {#each data.recentlyCreated as counter, i (counter.id)}
          <div class="animate-fade-up" style="animation-delay: {i * 60}ms">
            <CounterCard {counter} />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if data.recentlyUpdated.length > 0}
    <section
      aria-labelledby="recently-updated-heading"
      class="relative z-10 mt-16 border-t border-slate-200 dark:border-slate-700 pt-10"
    >
      <div class="flex items-center gap-3 mb-6">
        <h2
          id="recently-updated-heading"
          class="text-lg font-semibold text-slate-600 dark:text-slate-400"
        >
          Recently Updated
        </h2>
        <a
          href="/counters?sort=updated"
          class="group flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          See latest activity
          <span
            class="inline-block transition-transform group-hover:translate-x-0.5"
            >&rarr;</span
          >
        </a>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {#each data.recentlyUpdated as counter, i (counter.id)}
          <div class="animate-fade-up" style="animation-delay: {i * 60}ms">
            <CounterCard {counter} />
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>
