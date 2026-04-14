<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
</script>

<MetaTags
  title="Features — Count Collab"
  description="Explore all the features of Count Collab: real-time sync, shareable links, dashboards, activity history, member roles, and more."
  path="/features"
/>

<div class="max-w-5xl mx-auto px-4 py-16 sm:py-24">
  <div class="text-center mb-16">
    <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100">Features</h1>
    <p class="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
      Count Collab is packed with everything you need for seamless real-time collaboration. Here's what makes it stand out.
    </p>
  </div>

  <div class="space-y-16">
    <!-- Real-Time Sync -->
    <div class="flex flex-col md:flex-row gap-6 items-start">
      <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
        <ion-icon name="sparkles-outline" style="font-size: 28px;" aria-hidden="true"></ion-icon>
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Real-Time Sync</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
          Every change syncs instantly across all connected devices using WebSocket technology (Socket.IO). When someone increments a counter, every other person viewing it sees the update immediately — no manual refresh needed. Whether you're tracking attendance in real time or collaborating on a team goal, everyone is always on the same page.
        </p>
      </div>
    </div>

    <!-- Share via Link -->
    <div class="flex flex-col md:flex-row gap-6 items-start">
      <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
        <ion-icon name="share-social-outline" style="font-size: 28px;" aria-hidden="true"></ion-icon>
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Share via Link</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
          Each counter gets a unique URL that you can share with anyone. Send it via email, messaging apps, or social media — recipients can start collaborating immediately without downloading an app or creating an account. Private counters can also be shared via secure, token-based links.
        </p>
      </div>
    </div>

    <!-- Dashboards -->
    <div class="flex flex-col md:flex-row gap-6 items-start">
      <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400">
        <ion-icon name="grid-outline" style="font-size: 28px;" aria-hidden="true"></ion-icon>
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Dashboards</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
          Group related counters into custom dashboards for a clear, organized overview. Dashboards support drag-and-drop reordering, member management with role-based access, and can be shared with your team. Perfect for tracking multiple metrics in one place — like monitoring event stations, team KPIs, or project milestones.
        </p>
      </div>
    </div>

    <!-- Activity History -->
    <div class="flex flex-col md:flex-row gap-6 items-start">
      <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400">
        <ion-icon name="time-outline" style="font-size: 28px;" aria-hidden="true"></ion-icon>
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Activity History</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
          Every counter maintains a complete activity log showing who made each change and when. Trace back through increments and decrements to understand how a count evolved over time. Activity entries are timestamped and attributed to users, giving you full accountability and transparency.
        </p>
      </div>
    </div>

    <!-- Trends -->
    <div class="flex flex-col md:flex-row gap-6 items-start">
      <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400">
        <ion-icon name="trending-up-outline" style="font-size: 28px;" aria-hidden="true"></ion-icon>
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Trends</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
          Visual trend charts appear on every counter card, showing activity patterns at a glance. Spot trends, identify peak activity times, and understand how your counters are being used — all without navigating away from the overview.
        </p>
      </div>
    </div>

    <!-- Public & Private -->
    <div class="flex flex-col md:flex-row gap-6 items-start">
      <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400">
        <ion-icon name="shield-outline" style="font-size: 28px;" aria-hidden="true"></ion-icon>
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Public &amp; Private Counters</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
          Choose from three visibility modes: <strong>public</strong> (anyone can view and increment), <strong>public read-only</strong> (anyone can view but only members can increment), and <strong>private</strong> (only invited members can access). This gives you full control over who can see and modify your counters.
        </p>
      </div>
    </div>

    <!-- No Account Required -->
    <div class="flex flex-col md:flex-row gap-6 items-start">
      <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400">
        <ion-icon name="person-outline" style="font-size: 28px;" aria-hidden="true"></ion-icon>
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">No Account Required</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
          Get started in seconds without creating an account or providing an email address. Create public counters, share them, and start counting immediately. When you're ready for more — private counters, member roles, and personal dashboards — create an account to unlock these features.
        </p>
      </div>
    </div>

    <!-- Member Roles -->
    <div class="flex flex-col md:flex-row gap-6 items-start">
      <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-400">
        <ion-icon name="people-outline" style="font-size: 28px;" aria-hidden="true"></ion-icon>
      </div>
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Member Roles</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">
          Invite collaborators and assign granular roles: <strong>viewer</strong> (read-only access), <strong>incrementer</strong> (can modify the count), <strong>editor</strong> (can update counter details), or <strong>admin</strong> (full management access). This role-based access control ensures the right level of permissions for every team member.
        </p>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div class="text-center mt-20">
    <a
      href="/create"
      class="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      Try It Now — Create a Counter
      <span class="inline-block transition-transform group-hover:translate-x-0.5">&rarr;</span>
    </a>
  </div>
</div>
