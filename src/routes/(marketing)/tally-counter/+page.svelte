<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";

  const tallyGroups = [
    "||||/",
    "||||/",
    "||||/",
    "||||/",
    "||||/",
    "||||/",
    "||||/",
    "||||/",
    "||",
  ];
</script>

<MetaTags
  title="Free Online Tally Counter - Count Together | Count Collab"
  description="Use a free online tally counter to keep a shared count with your team. Create a counter, share one link, and see every update in real time."
  path="/tally-counter"
/>

<div class="overflow-hidden">
  <section class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
    <div
      class="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_0.85fr] lg:gap-20 lg:px-8"
    >
      <div>
        <p
          class="mb-5 font-mono text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-400"
        >
          Count Collab / Online tally
        </p>
        <h1
          class="max-w-2xl text-5xl font-extrabold leading-[1.02] text-slate-950 dark:text-white"
        >
          A tally counter for counting together
        </h1>
        <p
          class="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300"
        >
          Keep a running count from any device. Create a shared counter, send one
          link, and watch every update appear for everyone instantly.
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="/create?type=counter"
            class="inline-flex min-h-12 items-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            Create a tally counter
            <ion-icon name="arrow-forward-outline" aria-hidden="true"></ion-icon>
          </a>
          <a
            href="/how-it-works"
            class="inline-flex min-h-12 items-center rounded-lg px-4 py-3 font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950 dark:text-slate-200 dark:decoration-slate-600 dark:hover:text-white"
          >
            How it works
          </a>
        </div>
        <p class="mt-5 text-sm text-slate-500 dark:text-slate-400">
          Free to use. Public counters don't require an account.
        </p>
      </div>

      <div
        class="relative rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/20"
      >
        <div class="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
          <p class="font-mono text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Example tally
          </p>
          <span class="rounded bg-emerald-50 px-2 py-1 font-mono text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            CHECK-INS
          </span>
        </div>
        <div class="py-6">
          <p class="text-base font-medium text-slate-600 dark:text-slate-300">
            Workshop check-ins
          </p>
          <p class="mt-1 font-mono text-6xl font-bold tabular-nums text-slate-950 dark:text-white">
            42
          </p>
        </div>
        <div
          class="grid grid-cols-4 gap-3 border-t border-slate-200 pt-5 dark:border-slate-700"
          role="img"
          aria-label="42 tally marks, grouped by five"
        >
          {#each tallyGroups as group, index (index)}
            <span
              class="rounded-md bg-slate-50 px-2 py-3 text-center font-mono text-base font-semibold tracking-normal text-emerald-700 dark:bg-slate-900 dark:text-emerald-400"
              aria-hidden="true">{group}</span
            >
          {/each}
        </div>
        <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
          A visual example. Your shared counter updates live.
        </p>
      </div>
    </div>
  </section>

  <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p class="font-mono text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-400">
          One count, shared
        </p>
        <h2 class="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
          Replace the paper tally sheet
        </h2>
      </div>
      <div class="space-y-5 text-base leading-relaxed text-slate-600 dark:text-slate-300">
        <p>
          A tally counter is useful whenever people need to keep a simple total:
          visitors through a door, questions asked in a session, items collected,
          or progress toward a group goal. Count Collab makes that tally easy to
          share, so nobody has to keep the only copy of the number.
        </p>
        <p>
          Open the same counter on multiple devices and each change syncs in real
          time. For a public counter, anyone with the link can join without
          installing an app or signing up.
        </p>
      </div>
    </div>
  </section>

  <section class="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
    <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div class="mb-10 max-w-2xl">
        <p class="font-mono text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-400">
          Made for everyday counting
        </p>
        <h2 class="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
          A simple tally, useful anywhere
        </h2>
      </div>
      <div class="grid gap-8 md:grid-cols-3">
        <article class="border-t-2 border-emerald-600 pt-5 dark:border-emerald-400">
          <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
            Events and attendance
          </h3>
          <p class="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">
            Keep a shared headcount at the entrance, across rooms, or between
            event staff.
          </p>
        </article>
        <article class="border-t-2 border-emerald-600 pt-5 dark:border-emerald-400">
          <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
            Classroom participation
          </h3>
          <p class="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">
            Track questions, votes, or participation with a count the class can
            follow.
          </p>
        </article>
        <article class="border-t-2 border-emerald-600 pt-5 dark:border-emerald-400">
          <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
            Team goals and collections
          </h3>
          <p class="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">
            Make progress visible as your group works toward a shared target.
          </p>
        </article>
      </div>
    </div>
  </section>

  <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p class="font-mono text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-400">
          Get started in three steps
        </p>
        <h2 class="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
          Create, share, count
        </h2>
      </div>
      <ol class="grid gap-6 sm:grid-cols-3">
        <li class="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
          <span class="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">01</span>
          <h3 class="mt-2 font-bold text-slate-900 dark:text-slate-100">Name your counter</h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Set up a counter for the thing you want to track.
          </p>
        </li>
        <li class="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
          <span class="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">02</span>
          <h3 class="mt-2 font-bold text-slate-900 dark:text-slate-100">Share one link</h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Send it to the people helping you keep the tally.
          </p>
        </li>
        <li class="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
          <span class="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">03</span>
          <h3 class="mt-2 font-bold text-slate-900 dark:text-slate-100">Watch it update</h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            See every change reflected for everyone viewing the counter.
          </p>
        </li>
      </ol>
    </div>
  </section>

  <section class="bg-slate-950 text-white dark:bg-black">
    <div class="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
      <div>
        <p class="font-mono text-sm font-semibold uppercase text-emerald-400">
          Start your tally
        </p>
        <h2 class="mt-3 text-3xl font-bold">Make the count a team effort.</h2>
        <p class="mt-3 max-w-xl leading-relaxed text-slate-300">
          Create a counter and share it with the people counting alongside you.
        </p>
      </div>
      <a
        href="/create?type=counter"
        class="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        Create a tally counter
        <ion-icon name="arrow-forward-outline" aria-hidden="true"></ion-icon>
      </a>
    </div>
  </section>

  <p class="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400 sm:px-6 lg:px-8">
    Looking for more ideas? Browse our
    <a class="font-semibold text-emerald-800 underline underline-offset-4 dark:text-emerald-300" href="/use-cases">
      shared counter use cases
    </a>.
  </p>
</div>