<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
</script>

<MetaTags
  title="How It Works — Count Collab"
  description="Learn how to create a shared counter, share the link, collaborate in real time, and organize counters into dashboards — all in under a minute."
  path="/how-it-works"
/>

<div class="max-w-4xl mx-auto px-4 py-16 sm:py-24">
  <div class="text-center mb-16">
    <h1
      class="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100"
    >
      How It Works
    </h1>
    <p
      class="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto"
    >
      Getting started with Count Collab takes less than a minute. Follow these
      four simple steps to create your first shared counter and start
      collaborating in real time.
    </p>
  </div>

  <div>
    <!-- Step 1 -->
    <div class="flex gap-6">
      <div class="flex flex-col items-center">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg"
        >
          1
        </div>
        <div class="flex-1 w-px bg-slate-200 dark:bg-slate-700"></div>
      </div>
      <div class="pb-12">
        <h2
          class="flex h-12 items-center text-xl font-bold text-slate-900 dark:text-slate-100"
        >
          Create a Counter
        </h2>
        <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
          Click "Create a Counter" and give it a name and optional description.
          Choose <strong>public</strong> (anyone can view and change the count),
          <strong>public read-only</strong> (anyone can view; members with
          counting access can change it), or <strong>private</strong> (members can
          access). No account required for public counters — start counting in seconds.
        </p>
      </div>
    </div>

    <!-- Step 2 -->
    <div class="flex gap-6">
      <div class="flex flex-col items-center">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg"
        >
          2
        </div>
        <div class="flex-1 w-px bg-slate-200 dark:bg-slate-700"></div>
      </div>
      <div class="pb-12">
        <h2
          class="flex h-12 items-center text-xl font-bold text-slate-900 dark:text-slate-100"
        >
          Share the Link
        </h2>
        <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
          Every counter gets a unique URL you can share with anyone. Copy the
          link and send it via email, messaging apps, or social media. For
          private counters, a valid share-token link grants access to view and
          change the count, even without signing in. Sharing the link grants
          access.
        </p>
      </div>
    </div>

    <!-- Step 3 -->
    <div class="flex gap-6">
      <div class="flex flex-col items-center">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg"
        >
          3
        </div>
        <div class="flex-1 w-px bg-slate-200 dark:bg-slate-700"></div>
      </div>
      <div class="pb-12">
        <h2
          class="flex h-12 items-center text-xl font-bold text-slate-900 dark:text-slate-100"
        >
          Count Together in Real Time
        </h2>
        <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
          Anyone can change a public counter; members with counting access can
          change public read-only counters. Private counters are accessible to
          members and anyone with a valid share-token link, who can change the
          count. Each counter counts up or down as configured. Updates sync
          instantly so everyone sees changes as they happen.
        </p>
      </div>
    </div>

    <!-- Step 4 -->
    <div class="flex gap-6">
      <div class="flex flex-col items-center">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg"
        >
          4
        </div>
      </div>
      <div>
        <h2
          class="flex h-12 items-center text-xl font-bold text-slate-900 dark:text-slate-100"
        >
          Organize with Dashboards
        </h2>
        <p class="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
          As you create more counters, group them into dashboards for a clear,
          organized overview. Drag and drop to reorder, add or remove counters
          anytime, and share the dashboard link with your team. Dashboards
          support member roles too, so you can control who can edit the layout.
        </p>
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
