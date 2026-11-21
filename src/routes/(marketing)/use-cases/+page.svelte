<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
</script>

<MetaTags
  title="Use Cases — Count Collab"
  description="Discover how teams use Count Collab for tally counting, event attendance, fitness tracking, game scoreboards, community goals, and education."
  path="/use-cases"
/>

<div class="max-w-5xl mx-auto px-4 py-16 sm:py-24">
  <div class="text-center mb-16">
    <h1
      class="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100"
    >
      Use Cases
    </h1>
    <p
      class="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto"
    >
      From fitness challenges to event attendance — see how teams and
      communities use shared counters every day.
    </p>
  </div>

  <div class="space-y-12">
    <div
      id="tally-counter"
      class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
    >
      <div class="flex items-start gap-4">
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        >
          <ion-icon
            name="list-outline"
            style="font-size: 24px;"
            aria-hidden="true"
          ></ion-icon>
        </span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
            Online Tally Counter
          </h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            For a quick in-person vote, create one counter for each response,
            share its link with tally keepers, and update it as votes arrive.
            Live totals give the group a running result without reconciling
            separate sheets.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> event check-ins, classroom participation,
            group goals, quick headcounts
          </p>
          <a
            href="/tally-counter"
            class="mt-4 inline-flex items-center gap-2 font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-900 dark:text-emerald-300 dark:decoration-emerald-700 dark:hover:text-emerald-200"
          >
            Explore the online tally counter
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Event Attendance -->
    <div
      class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
    >
      <div class="flex items-start gap-4">
        <span class="text-4xl">🎟️</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
            Event Attendance
          </h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            At a conference, create a counter for each entrance, share the
            matching counter link with door staff, and group the counters on an
            event dashboard. Coordinators can see each entrance's live total in
            one place and review attendance across the venue.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> conferences, meetups, venues, festivals,
            trade shows
          </p>
        </div>
      </div>
    </div>

    <!-- Fitness & Habit Tracking -->
    <div
      class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
    >
      <div class="flex items-start gap-4">
        <span class="text-4xl">💪</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
            Fitness &amp; Habit Tracking
          </h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            For a walking group, use one counter for completed group walks,
            share its link with members, and update it after each outing. The
            live total makes progress visible between meetups, so everyone can
            see how far the shared goal has advanced.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> workout challenges, hydration tracking,
            step goals, study sessions, reading goals
          </p>
        </div>
      </div>
    </div>

    <!-- Game Scoreboards -->
    <div
      class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
    >
      <div class="flex items-start gap-4">
        <span class="text-4xl">🎮</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
            Game Scoreboards
          </h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            For trivia, create a counter per team and group them on a scoreboard
            dashboard, then share the dashboard with players. Add points after
            each round; live totals show the standings before the next question.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> board game nights, trivia competitions,
            hackathons, sports day events
          </p>
        </div>
      </div>
    </div>

    <!-- Community Goals -->
    <div
      class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
    >
      <div class="flex items-start gap-4">
        <span class="text-4xl">🎯</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
            Community Goals
          </h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            For a neighborhood cleanup, count filled bags with one shared
            counter, or create one per cleanup zone and group them on a
            dashboard. Share counter links with volunteers so updates appear in
            the live totals, giving coordinators a view of progress across
            zones.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> fundraisers, volunteer tracking, community
            milestones, group challenges
          </p>
        </div>
      </div>
    </div>

    <!-- Classroom & Education -->
    <div
      class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm"
    >
      <div class="flex items-start gap-4">
        <span class="text-4xl">🏫</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
            Classroom &amp; Education
          </h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            For a classroom practice round, assign member roles, create a
            counter for each group's correctly answered questions, and arrange
            the counters on a dashboard. Share counter links for updates; live
            totals let the class compare progress between rounds.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> participation tracking, live polls, student
            engagement, team activities
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div class="text-center mt-20">
    <a
      href="/create?type=counter"
      class="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      Create Your First Counter
      <span
        class="inline-block transition-transform group-hover:translate-x-0.5"
        >&rarr;</span
      >
    </a>
  </div>
</div>
