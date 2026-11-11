<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
  import TallyClickerIllustration from "$lib/components/TallyClickerIllustration.svelte";
</script>

<MetaTags
  title="Free Online Tally Counter - Count Together | Count Collab"
  description="The simplicity of a tally clicker or paper tally, now shared online. Create a free tally counter, share one link, and count together in real time."
  path="/tally-counter"
/>

<div class="overflow-hidden bg-slate-50 dark:bg-slate-900">
  <section>
    <div
      class="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1fr_0.85fr] lg:gap-20 lg:px-8"
    >
      <div>
        <p
          class="mb-5 font-mono text-sm font-semibold uppercase text-blue-600 dark:text-blue-400"
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
          All the simplicity of a handheld clicker or a tally on paper, with
          everyone on the same count. Create a free online tally counter, share
          one link, and keep counting together from any device.
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="/create?type=counter"
            class="inline-flex min-h-12 items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Create a tally counter
            <ion-icon name="arrow-forward-outline" aria-hidden="true"
            ></ion-icon>
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

      <TallyClickerIllustration />
    </div>
  </section>

  <section class="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p
          class="font-mono text-sm font-semibold uppercase text-blue-600 dark:text-blue-400"
        >
          One count, shared
        </p>
        <h2 class="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
          From clickers and tally sheets to one shared count
        </h2>
      </div>
      <div
        class="space-y-5 text-base leading-relaxed text-slate-600 dark:text-slate-300"
      >
        <p>
          A thumb on a clicker, a mark on a sheet, a tap on a screen: a tally
          counter keeps a running total, one at a time. Use it for visitors
          through a door, questions in a session, items collected, or progress
          toward a group goal.
        </p>
        <p>
          Count Collab brings that familiar idea online, so the total doesn't
          stay in one person's hand or notebook. Open the same counter on
          multiple devices and each change syncs in real time. For a public
          counter, anyone with the link can join without installing an app or
          signing up.
        </p>
      </div>
    </div>
  </section>

  <section
    class="mx-auto max-w-6xl space-y-16 px-4 py-20 sm:space-y-20 sm:px-6 sm:py-24 lg:px-8"
    aria-labelledby="tally-uses-heading tally-steps-heading"
  >
    <div>
      <div class="mb-10 max-w-2xl">
        <p
          class="font-mono text-sm font-semibold uppercase text-blue-600 dark:text-blue-400"
        >
          Made for everyday counting
        </p>
        <h2
          id="tally-uses-heading"
          class="mt-3 text-3xl font-bold text-slate-950 dark:text-white"
        >
          A simple tally, useful anywhere
        </h2>
      </div>
      <div class="grid gap-8 md:grid-cols-3">
        <article class="border-t-2 border-blue-600 pt-5 dark:border-blue-400">
          <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
            Events and attendance
          </h3>
          <p class="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">
            Bring the hand clicker idea to your whole crew. Keep a shared
            headcount at the entrance, across rooms, or between event staff.
          </p>
        </article>
        <article class="border-t-2 border-blue-600 pt-5 dark:border-blue-400">
          <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
            Classroom participation
          </h3>
          <p class="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">
            Turn a classroom tally into a count everyone can follow. Track
            questions, votes, or participation as they happen.
          </p>
        </article>
        <article class="border-t-2 border-blue-600 pt-5 dark:border-blue-400">
          <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
            Team goals and collections
          </h3>
          <p class="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">
            Make progress visible as your group works toward a shared target.
          </p>
        </article>
      </div>
    </div>
    <div class="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p
          class="font-mono text-sm font-semibold uppercase text-blue-600 dark:text-blue-400"
        >
          Get started in three steps
        </p>
        <h2
          id="tally-steps-heading"
          class="mt-3 text-3xl font-bold text-slate-950 dark:text-white"
        >
          Create, share, count
        </h2>
      </div>
      <ol class="grid gap-6 sm:grid-cols-3">
        <li class="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
          <span
            class="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400"
            >01</span
          >
          <h3 class="mt-2 font-bold text-slate-900 dark:text-slate-100">
            Name your counter
          </h3>
          <p
            class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
          >
            Set up a counter for the thing you want to track.
          </p>
        </li>
        <li class="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
          <span
            class="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400"
            >02</span
          >
          <h3 class="mt-2 font-bold text-slate-900 dark:text-slate-100">
            Share one link
          </h3>
          <p
            class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
          >
            Send it to the people helping you keep the tally.
          </p>
        </li>
        <li class="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
          <span
            class="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400"
            >03</span
          >
          <h3 class="mt-2 font-bold text-slate-900 dark:text-slate-100">
            Watch it update
          </h3>
          <p
            class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
          >
            See every change reflected for everyone viewing the counter.
          </p>
        </li>
      </ol>
    </div>
  </section>

  <section>
    <div
      class="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 py-20 sm:px-6 sm:py-24 md:flex-row md:items-center lg:px-8"
    >
      <div>
        <p
          class="font-mono text-sm font-semibold uppercase text-blue-600 dark:text-blue-400"
        >
          Start your tally
        </p>
        <h2 class="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
          Make the count a team effort.
        </h2>
        <p
          class="mt-3 max-w-xl leading-relaxed text-slate-600 dark:text-slate-300"
        >
          No clicker to pass around. No tallies to add up later. Just one
          counter shared with the people counting alongside you.
        </p>
      </div>
      <a
        href="/create?type=counter"
        class="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Create a tally counter
        <ion-icon name="arrow-forward-outline" aria-hidden="true"></ion-icon>
      </a>
    </div>
  </section>

  <p
    class="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400 sm:px-6 lg:px-8"
  >
    Looking for more ideas? Browse our
    <a
      class="font-semibold text-blue-600 underline underline-offset-4 dark:text-blue-400"
      href="/use-cases"
    >
      shared counter use cases
    </a>.
  </p>
</div>
