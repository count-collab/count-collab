<script lang="ts">
  const { version, commit }: { version: string; commit: string } = $props();
</script>

<footer
  class="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 mt-12"
>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
      <div>
        <h3
          class="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4"
        >
          Product
        </h3>
        <ul class="space-y-2">
          <li>
            <a
              href="/?landing"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >Landing Page</a
            >
          </li>
          <li>
            <a
              href="/features"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >Features</a
            >
          </li>
          <li>
            <a
              href="/use-cases"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >Use Cases</a
            >
          </li>
          <li>
            <a
              href="/how-it-works"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >How It Works</a
            >
          </li>
          <li>
            <a
              href="/faq"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >FAQ</a
            >
          </li>
        </ul>
      </div>
      <div>
        <h3
          class="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4"
        >
          Explore
        </h3>
        <ul class="space-y-2">
          <li>
            <a
              href="/counters"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >Browse Counters</a
            >
          </li>
          <li>
            <a
              href="/dashboards"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >Browse Dashboards</a
            >
          </li>
          <li>
            <a
              href="/create?type=counter"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >Create a Counter</a
            >
          </li>
        </ul>
      </div>
      <div>
        <h3
          class="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4"
        >
          Account
        </h3>
        <ul class="space-y-2">
          <li>
            <a
              href="/login"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >Sign In</a
            >
          </li>
          <li>
            <a
              href="/home"
              class="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
              >Home</a
            >
          </li>
        </ul>
      </div>
      <div>
        <h3
          class="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4"
        >
          About
        </h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Count Collab is a free, real-time collaborative counter platform built
          for teams and communities.
        </p>
      </div>
    </div>
    <div
      class="border-t border-slate-200 dark:border-slate-800 mt-10 pt-8 text-center"
    >
      <p class="text-sm text-slate-500 dark:text-slate-500">
        &copy; 2026 Count Collab. Shared counts for everyone.
      </p>
      <p class="mt-1 text-xs text-slate-400 dark:text-slate-600">
        v{version} · {commit}
      </p>
    </div>
  </div>
</footer>
