<script lang="ts">
  import { page } from "$app/stores";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
</script>

<svelte:head>
  <title
    >{$page.status === 404
      ? "Page Not Found"
      : $page.status === 403
        ? "Access Denied"
        : "Error"} | Count Collab</title
  >
</svelte:head>

<div class="flex flex-col flex-1 min-h-screen">
  <nav
    class="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm dark:shadow-slate-900/50 border-b border-slate-200 dark:border-slate-700"
  >
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"
    >
      <h1 class="text-2xl font-bold">
        <a
          href="/"
          class="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent"
        >
          Count Collab
        </a>
      </h1>
      <a
        href="/"
        class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        Home
      </a>
    </div>
  </nav>

  <main class="flex-1 flex items-center justify-center py-16 sm:py-24">
    <div class="text-center max-w-md mx-auto px-4">
      {#if $page.status === 404}
        <div
          class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <span class="text-4xl">🔍</span>
        </div>
        <p
          class="text-6xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent"
        >
          404
        </p>
        <h2
          class="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100"
        >
          Page not found
        </h2>
        <p class="mt-2 text-slate-500 dark:text-slate-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
      {:else if $page.status === 403}
        <div
          class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20"
        >
          <span class="text-4xl">🔒</span>
        </div>
        <p
          class="text-6xl font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent"
        >
          403
        </p>
        <h2
          class="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100"
        >
          Access denied
        </h2>
        <p class="mt-2 text-slate-500 dark:text-slate-400">
          {$page.error?.message ||
            "You don't have permission to view this page."}
        </p>
      {:else}
        <div
          class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20"
        >
          <span class="text-4xl">⚠️</span>
        </div>
        <p
          class="text-6xl font-extrabold bg-gradient-to-r from-red-500 to-rose-500 dark:from-red-400 dark:to-rose-400 bg-clip-text text-transparent"
        >
          {$page.status}
        </p>
        <h2
          class="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100"
        >
          Something went wrong
        </h2>
        <p class="mt-2 text-slate-500 dark:text-slate-400">
          {$page.error?.message || "An unexpected error occurred."}
        </p>
      {/if}

      <div
        class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
      >
        <a
          href="/"
          class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Go home
        </a>
        <a
          href="/counters"
          class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          Browse counters
        </a>
      </div>
    </div>
  </main>

  <SiteFooter version={$page.data?.buildInfo?.version ?? ''} commit={$page.data?.buildInfo?.commit ?? ''} />
</div>
