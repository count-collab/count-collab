<script lang="ts">
  import { browser } from "$app/environment";
  import { invalidate } from "$app/navigation";
  import CounterCard from "$lib/components/CounterCard.svelte";
  import FaqAccordion from "$lib/components/FaqAccordion.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import RollingNumber from "$lib/components/RollingNumber.svelte";
  import { faqItems } from "$lib/data/faq";
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

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Count Collab",
        url: "https://countcollab.com",
        description:
          "Free real-time collaborative counter platform. Create counters, share the link, and count together instantly.",
        applicationCategory: "Productivity",
        operatingSystem: "All",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  });
</script>

<MetaTags
  title="Count Collab — Free Real-Time Shared Counters for Teams & Friends"
  description="Create counters, share the link, and count together in real time. Free collaborative counter platform with dashboards, activity history, and member roles. No sign-up required."
  path="/"
/>

<svelte:head>
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<div class="relative">
  <!-- Background orbs -->
  <div
    class="pointer-events-none absolute top-0 left-0 h-[500px] w-[500px] rounded-full bg-blue-400/20 dark:bg-blue-500/10 blur-[120px]"
    aria-hidden="true"
  ></div>
  <div
    class="pointer-events-none absolute top-[40%] right-0 h-[400px] w-[400px] rounded-full bg-indigo-400/15 dark:bg-indigo-500/10 blur-[120px]"
    aria-hidden="true"
  ></div>

  <!-- HERO -->
  <section
    class="text-center px-4 pt-20 pb-24 sm:pt-28 sm:pb-32 max-w-5xl mx-auto"
  >
    <p
      class="mb-4 inline-block rounded-full bg-blue-100 dark:bg-blue-900 px-4 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 tracking-wide"
    >
      Free &middot; No sign-up &middot; Real-time sync
    </p>
    <h1
      class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight"
    >
      Count together,
      <span
        class="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent"
      >
        in real time
      </span>
    </h1>
    <p
      class="mt-6 text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
    >
      Count Collab is a free, real-time collaborative counter platform. Create a
      counter, share the link, and let anyone increment it instantly — no
      sign-up required. Organize counters into dashboards, track activity
      history, and collaborate with your team.
    </p>

    <!-- Social proof stats -->
    <div class="mt-10 flex flex-col items-center gap-1">
      <p
        class="text-5xl sm:text-7xl font-extrabold text-blue-600 dark:text-blue-400"
      >
        <RollingNumber value={data.globalSum} />
      </p>
      <p
        class="text-base text-slate-500 dark:text-slate-400 inline-flex items-center gap-1"
      >
        total counts across
        <span class="font-semibold inline-flex items-center"
          ><RollingNumber value={data.counterCount} /></span
        >
        counters
      </p>
    </div>

    <!-- CTA buttons -->
    <div class="mt-10 flex flex-wrap gap-4 justify-center">
      <a
        href="/create?type=counter"
        class="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Create a Counter
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
  </section>

  <!-- HOW IT WORKS -->
  <section id="how-it-works" class="px-4 py-20 sm:py-24 max-w-6xl mx-auto">
    <div class="text-center mb-16">
      <h2
        class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100"
      >
        How It Works
      </h2>
      <p
        class="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto"
      >
        Get started in under a minute. Four simple steps to create your first
        shared counter.
      </p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
      <div
        class="relative text-center p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
        >
          <ion-icon
            name="add-circle-outline"
            style="font-size: 24px;"
            aria-hidden="true"
          ></ion-icon>
        </div>
        <p
          class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2"
        >
          Step 1
        </p>
        <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
          Create a Counter
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Give it a name and choose public or private visibility. That's it.
        </p>
      </div>
      <div
        class="relative text-center p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
        >
          <ion-icon
            name="share-social-outline"
            style="font-size: 24px;"
            aria-hidden="true"
          ></ion-icon>
        </div>
        <p
          class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2"
        >
          Step 2
        </p>
        <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
          Share the Link
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Every counter gets a unique URL. Send it to anyone — no app download
          required.
        </p>
      </div>
      <div
        class="relative text-center p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
        >
          <ion-icon
            name="people-outline"
            style="font-size: 24px;"
            aria-hidden="true"
          ></ion-icon>
        </div>
        <p
          class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2"
        >
          Step 3
        </p>
        <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
          Count Together
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Everyone with the link can increment in real time. Changes sync
          instantly across all devices.
        </p>
      </div>
      <div
        class="relative text-center p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
        >
          <ion-icon
            name="grid-outline"
            style="font-size: 24px;"
            aria-hidden="true"
          ></ion-icon>
        </div>
        <p
          class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2"
        >
          Step 4
        </p>
        <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
          Organize with Dashboards
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Group related counters into dashboards for a clear, organized
          overview.
        </p>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section
    id="features"
    class="px-4 py-20 sm:py-24 bg-slate-50/50 dark:bg-slate-900/50"
  >
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-16">
        <h2
          class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100"
        >
          Everything You Need for Collaborative Counting
        </h2>
        <p
          class="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto"
        >
          A full-featured platform designed for seamless real-time collaboration
          — from flexible counter types to developer-friendly tools.
        </p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div
            class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400"
          >
            <ion-icon
              name="sparkles-outline"
              style="font-size: 20px;"
              aria-hidden="true"
            ></ion-icon>
          </div>
          <h3 class="font-bold text-slate-900 dark:text-slate-100">
            Real-Time Sync
          </h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Every change syncs instantly across all devices via WebSocket. No
            refresh needed — always up to date.
          </p>
        </div>
        <div
          class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div
            class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
          >
            <ion-icon
              name="share-social-outline"
              style="font-size: 20px;"
              aria-hidden="true"
            ></ion-icon>
          </div>
          <h3 class="font-bold text-slate-900 dark:text-slate-100">
            Share via Link
          </h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Each counter gets a unique URL. Share it anywhere — no app download
            or installation required.
          </p>
        </div>
        <div
          class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div
            class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
          >
            <ion-icon
              name="grid-outline"
              style="font-size: 20px;"
              aria-hidden="true"
            ></ion-icon>
          </div>
          <h3 class="font-bold text-slate-900 dark:text-slate-100">
            Dashboards
          </h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Group related counters into custom dashboards for organized,
            at-a-glance tracking.
          </p>
        </div>
        <div
          class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div
            class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400"
          >
            <ion-icon
              name="time-outline"
              style="font-size: 20px;"
              aria-hidden="true"
            ></ion-icon>
          </div>
          <h3 class="font-bold text-slate-900 dark:text-slate-100">
            Activity History
          </h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            See who changed what and when with a complete activity log for every
            counter.
          </p>
        </div>
        <div
          class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div
            class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400"
          >
            <ion-icon
              name="trending-up-outline"
              style="font-size: 20px;"
              aria-hidden="true"
            ></ion-icon>
          </div>
          <h3 class="font-bold text-slate-900 dark:text-slate-100">Trends</h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Visual trend charts show counter activity at a glance — spot
            patterns instantly.
          </p>
        </div>
        <div
          class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div
            class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400"
          >
            <ion-icon
              name="shield-outline"
              style="font-size: 20px;"
              aria-hidden="true"
            ></ion-icon>
          </div>
          <h3 class="font-bold text-slate-900 dark:text-slate-100">
            Public &amp; Private
          </h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Control visibility: public for everyone, read-only for viewing, or
            private for your team only.
          </p>
        </div>
        <div
          class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div
            class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400"
          >
            <ion-icon
              name="person-outline"
              style="font-size: 20px;"
              aria-hidden="true"
            ></ion-icon>
          </div>
          <h3 class="font-bold text-slate-900 dark:text-slate-100">
            No Account Required
          </h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Start counting in seconds. Sign up later to unlock member roles and
            private counters.
          </p>
        </div>
        <div
          class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div
            class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-400"
          >
            <ion-icon
              name="people-outline"
              style="font-size: 20px;"
              aria-hidden="true"
            ></ion-icon>
          </div>
          <h3 class="font-bold text-slate-900 dark:text-slate-100">
            Member Roles
          </h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Invite collaborators as viewer, incrementer, editor, or admin — full
            access control.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- USE CASES -->
  <section id="use-cases" class="px-4 py-20 sm:py-24 max-w-6xl mx-auto">
    <div class="text-center mb-16">
      <h2
        class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100"
      >
        How Teams Use Count Collab
      </h2>
      <p
        class="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto"
      >
        From fitness challenges to inventory tracking — see how teams and
        communities use shared counters every day.
      </p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div class="mb-3 text-3xl">🎟️</div>
        <h3 class="font-bold text-slate-900 dark:text-slate-100">
          Event Attendance
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Track headcount at events with a shared counter everyone can update in
          real time. Perfect for conferences, meetups, and venues.
        </p>
      </div>
      <div
        class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div class="mb-3 text-3xl">💪</div>
        <h3 class="font-bold text-slate-900 dark:text-slate-100">
          Fitness &amp; Habit Tracking
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Count workouts, water intake, or steps with friends and stay
          accountable together. Real-time sync keeps everyone motivated.
        </p>
      </div>
      <div
        class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div class="mb-3 text-3xl">📦</div>
        <h3 class="font-bold text-slate-900 dark:text-slate-100">
          Inventory &amp; Stock
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Keep a running tally of supplies, equipment, or stock across your team
          — no spreadsheet needed.
        </p>
      </div>
      <div
        class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div class="mb-3 text-3xl">🎮</div>
        <h3 class="font-bold text-slate-900 dark:text-slate-100">
          Game Scoreboards
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Real-time scoreboards for board games, trivia nights, and
          competitions. Everyone sees the score update live.
        </p>
      </div>
      <div
        class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div class="mb-3 text-3xl">🎯</div>
        <h3 class="font-bold text-slate-900 dark:text-slate-100">
          Community Goals
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Rally your community around a shared counting goal and watch progress
          in real time.
        </p>
      </div>
      <div
        class="p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div class="mb-3 text-3xl">🏫</div>
        <h3 class="font-bold text-slate-900 dark:text-slate-100">
          Classroom &amp; Education
        </h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Teachers track participation points, student progress, or class votes
          in real time with a shared counter.
        </p>
      </div>
    </div>
  </section>

  <!-- POPULAR COUNTERS -->
  {#if data.popularCounters.length > 0}
    <section class="px-4 py-20 sm:py-24 bg-slate-50/50 dark:bg-slate-900/50">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
          <h2
            class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100"
          >
            Popular Counters
          </h2>
          <p class="mt-4 text-lg text-slate-500 dark:text-slate-400">
            See what the community is counting right now.
          </p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {#each data.popularCounters as counter, i (counter.id)}
            <div class="animate-fade-up" style="animation-delay: {i * 60}ms">
              <CounterCard {counter} />
            </div>
          {/each}
        </div>
        <div class="text-center mt-8">
          <a
            href="/counters"
            class="group inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
          >
            Browse all counters
            <span
              class="inline-block transition-transform group-hover:translate-x-0.5"
              >&rarr;</span
            >
          </a>
        </div>
      </div>
    </section>
  {/if}

  <!-- FAQ -->
  <section id="faq" class="px-4 py-20 sm:py-24 max-w-3xl mx-auto">
    <div class="text-center mb-12">
      <h2
        class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100"
      >
        Frequently Asked Questions
      </h2>
      <p class="mt-4 text-lg text-slate-500 dark:text-slate-400">
        Everything you need to know about Count Collab.
      </p>
    </div>
    <FaqAccordion items={faqItems} />
  </section>

  <!-- SUPPORT -->
  <section class="px-4 py-16 sm:py-20 text-center">
    <div class="max-w-xl mx-auto">
      <div class="text-3xl mb-4">☕</div>
      <h2
        class="text-2xl font-bold text-slate-900 dark:text-slate-100"
      >
        Enjoying Count Collab?
      </h2>
      <p class="mt-3 text-slate-500 dark:text-slate-400">
        Count Collab is free and always will be. If you find it useful, consider
        supporting us.
      </p>
      <a
        href="https://buymeacoffee.com/countcollab"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-white font-semibold shadow-sm transition-all hover:bg-amber-600 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      >
        <ion-icon name="cafe-outline" style="font-size: 18px;"></ion-icon>
        Buy us a coffee
      </a>
    </div>
  </section>

  <!-- FOOTER CTA -->
  <section class="px-4 py-20 sm:py-24 text-center">
    <div class="max-w-2xl mx-auto">
      <h2
        class="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100"
      >
        Ready to Start Counting?
      </h2>
      <p class="mt-4 text-lg text-slate-500 dark:text-slate-400">
        Create your first counter in seconds — no sign-up required.
      </p>
      <div class="mt-8 flex flex-wrap gap-4 justify-center">
        <a
          href="/create?type=counter"
          class="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Create a Counter
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
</div>
