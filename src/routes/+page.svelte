<script lang="ts">
  import { browser } from "$app/environment";
  import { invalidate } from "$app/navigation";
  import CounterCard from "$lib/components/CounterCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { onCounterCreated, onCounterUpdated } from "$lib/stores/counters";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const userSlice = $derived(data.userCounters.slice(0, 6));
  const popularSlice = $derived(data.popularCounters.slice(0, 6));

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
  path="/"
/>

<svelte:window bind:scrollY={scrollY} />

<div class="relative pb-16">
  <!-- Page-wide background orbs with ambient drift + scroll parallax -->
  <div
    class="pointer-events-none absolute top-0 left-0 h-[500px] w-[500px] rounded-full bg-blue-400/20 blur-[120px] animate-orb-drift-1"
    style="translate: 0 {scrollY * 0.15}px"
    aria-hidden="true"
  ></div>
  <div
    class="pointer-events-none absolute top-[40%] right-0 h-[400px] w-[400px] rounded-full bg-indigo-400/15 blur-[120px] animate-orb-drift-2"
    style="translate: 0 {scrollY * -0.1}px"
    aria-hidden="true"
  ></div>

  <section
    bind:this={heroEl}
    class="full-bleed text-center min-h-[calc(100vh-250px)] flex flex-col items-center justify-center px-4 -mt-8 pb-20"
  >
    <div
      class="flex flex-col items-center"
      style="opacity: {1 - scrollProgress * 0.6}; transform: translateY({scrollY * 0.25}px)"
    >
      <p
        class="hero-stagger mb-3 inline-block rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-700 tracking-wide"
      >
      Real-time collaborative counting
    </p>
    <h1
      class="hero-stagger text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight"
      style="animation-delay: 100ms"
    >
      Count together,
      <span
        class="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
      >
        in real time
      </span>
    </h1>
    <p class="hero-stagger mt-4 text-lg sm:text-xl text-slate-500 max-w-xl mx-auto" style="animation-delay: 200ms">
      Create a counter, share the link, and let anyone increment it instantly.
      No sign-up required.
    </p>

    <div class="hero-stagger mt-8 flex flex-wrap gap-4 justify-center" style="animation-delay: 300ms">
      <a
        href="/create"
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
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-7 py-3.5 font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        Browse Counters
      </a>
    </div>
    </div>
  </section>

  {#if data.userCounters.length > 0}
    <!-- Logged-in: side-by-side layout -->
    <div class="relative z-10 grid md:grid-cols-2 gap-10">
      <section aria-labelledby="your-counters-heading">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="h-8 w-1 rounded-full bg-gradient-to-b from-blue-600 to-indigo-500"></div>
            <h2 id="your-counters-heading" class="text-2xl font-bold text-slate-900">Your Counters</h2>
          </div>
          <a
            href="/my-counters"
            class="group flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
          >
            View all
            <span class="inline-block transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </a>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {#each userSlice as counter, i (counter.id)}
            <div
              class="animate-fade-up {userSlice.length % 2 === 1 &&
              i === userSlice.length - 1
                ? 'sm:col-span-2'
                : ''}"
              style="animation-delay: {i * 60}ms"
            >
              <CounterCard {counter} showBadges />
            </div>
          {/each}
        </div>
      </section>

      <section aria-labelledby="popular-counters-heading-auth">
        <div class="flex items-center gap-3 mb-6">
          <div class="h-8 w-1 rounded-full bg-gradient-to-b from-blue-600 to-indigo-500"></div>
          <h2 id="popular-counters-heading-auth" class="text-2xl font-bold text-slate-900">Popular Counters</h2>
        </div>
        {#if data.popularCounters.length > 0}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {#each popularSlice as counter, i (counter.id)}
              <div
                class="animate-fade-up {popularSlice.length % 2 === 1 &&
                i === popularSlice.length - 1
                  ? 'sm:col-span-2'
                  : ''}"
                style="animation-delay: {i * 60}ms"
              >
                <CounterCard {counter} />
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-slate-500 text-center py-8">No public counters yet.</p>
        {/if}
      </section>
    </div>
  {:else if data.popularCounters.length > 0}
    <!-- Guest or user with no counters -->
    <section aria-labelledby="popular-counters-heading" class="relative z-10">
      <div class="flex items-center gap-3 mb-6">
        <div class="h-8 w-1 rounded-full bg-gradient-to-b from-blue-600 to-indigo-500"></div>
        <h2 id="popular-counters-heading" class="text-2xl font-bold text-slate-900">Popular Counters</h2>
      </div>
      <div
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
      >
        {#each data.popularCounters as counter, i (counter.id)}
          <div class="animate-fade-up" style="animation-delay: {i * 60}ms">
            <CounterCard {counter} />
          </div>
        {/each}
      </div>
    </section>
  {:else}
    <section class="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <ion-icon name="add-circle-outline" style="font-size: 32px; color: rgb(37 99 235);" aria-hidden="true"></ion-icon>
      </div>
      <h3 class="text-lg font-semibold text-slate-900">No counters yet</h3>
      <p class="mt-1 text-slate-500">Be the first to create one and start counting together.</p>
      <a
        href="/create"
        class="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Create Counter
      </a>
    </section>
  {/if}
</div>
