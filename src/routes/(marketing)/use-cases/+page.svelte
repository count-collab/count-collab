<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
</script>

<MetaTags
  title="Use Cases — Count Collab"
  description="Discover how teams use Count Collab for event attendance, fitness tracking, inventory management, game scoreboards, community goals, and education."
  path="/use-cases"
/>

<div class="max-w-5xl mx-auto px-4 py-16 sm:py-24">
  <div class="text-center mb-16">
    <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100">Use Cases</h1>
    <p class="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
      From fitness challenges to inventory tracking — see how teams and communities use shared counters every day.
    </p>
  </div>

  <div class="space-y-12">
    <!-- Event Attendance -->
    <div class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div class="flex items-start gap-4">
        <span class="text-4xl">🎟️</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Event Attendance</h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            Track headcount at events, conferences, and meetups with a shared counter that everyone on the door can update in real time. Multiple door staff can increment simultaneously and see the same live total. Create separate counters for different rooms or areas and group them into a single dashboard for a complete venue overview.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> conferences, meetups, venues, festivals, trade shows
          </p>
        </div>
      </div>
    </div>

    <!-- Fitness & Habit Tracking -->
    <div class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div class="flex items-start gap-4">
        <span class="text-4xl">💪</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Fitness &amp; Habit Tracking</h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            Count workouts, water glasses, steps, or any daily habit with friends, and stay accountable together. Each participant increments the shared counter when they complete their task. The activity history shows who contributed and when, turning daily habits into a collaborative challenge.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> workout challenges, hydration tracking, step goals, study sessions, reading goals
          </p>
        </div>
      </div>
    </div>

    <!-- Inventory & Stock -->
    <div class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div class="flex items-start gap-4">
        <span class="text-4xl">📦</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Inventory &amp; Stock Tracking</h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            Keep a running tally of supplies, equipment, or stock across your team — no spreadsheet needed. Team members increment or decrement the counter as items are added or used. Group multiple inventory counters into a dashboard for a complete stock overview. Real-time sync ensures the count is always accurate.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> warehouse stock, office supplies, event materials, food inventory
          </p>
        </div>
      </div>
    </div>

    <!-- Game Scoreboards -->
    <div class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div class="flex items-start gap-4">
        <span class="text-4xl">🎮</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Game Scoreboards</h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            Create real-time scoreboards for board games, trivia nights, and competitions. Each player or team gets their own counter, and scores update live for everyone to see. Group player counters into a dashboard for a complete leaderboard view. No app needed — just share the link and everyone can follow along.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> board game nights, trivia competitions, hackathons, sports day events
          </p>
        </div>
      </div>
    </div>

    <!-- Community Goals -->
    <div class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div class="flex items-start gap-4">
        <span class="text-4xl">🎯</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Community Goals</h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            Rally your community, organization, or online following around a shared counting goal and watch progress accumulate in real time. Whether it's a charity drive counting donations, a community tracking volunteer hours, or a group chasing a collective milestone, shared counters make the progress visible to everyone.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> fundraisers, volunteer tracking, community milestones, group challenges
          </p>
        </div>
      </div>
    </div>

    <!-- Classroom & Education -->
    <div class="p-8 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div class="flex items-start gap-4">
        <span class="text-4xl">🏫</span>
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Classroom &amp; Education</h2>
          <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            Teachers can track participation points, student progress, or classroom votes in real time with a shared counter. Students see updates instantly, creating a more engaging and interactive learning environment. Private counters with member roles let teachers control who can modify scores while students observe.
          </p>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
            <strong>Perfect for:</strong> participation tracking, live polls, student engagement, team activities
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div class="text-center mt-20">
    <a
      href="/create"
      class="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      Create Your First Counter
      <span class="inline-block transition-transform group-hover:translate-x-0.5">&rarr;</span>
    </a>
  </div>
</div>
