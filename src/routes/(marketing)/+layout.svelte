<script lang="ts">
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";

  const { children, data } = $props();
  const session = $derived(data.session);

  let mobileMenuOpen = $state(false);
</script>

<nav
  class="sticky top-0 z-20 relative bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm dark:shadow-slate-900/50 border-b border-slate-200 dark:border-slate-700"
>
  <div
    class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"
  >
    <h1 class="text-2xl font-bold">
      <a
        href="/"
        class="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent"
      >
        Count Collab
      </a>
    </h1>

    <!-- Mobile -->
    <div class="flex items-center gap-2 md:hidden">
      <ThemeToggle />
      <button
        type="button"
        onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
        class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        aria-label="Toggle menu"
        aria-expanded={mobileMenuOpen}
      >
        {#if mobileMenuOpen}
          <ion-icon name="close-outline" style="font-size: 24px;"></ion-icon>
        {:else}
          <ion-icon name="menu-outline" style="font-size: 24px;"></ion-icon>
        {/if}
      </button>
    </div>

    <!-- Desktop nav -->
    <div class="hidden md:flex items-center gap-6 flex-1 ml-8">
      <a
        href="/features"
        class="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
        >Features</a
      >
      <a
        href="/use-cases"
        class="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
        >Use Cases</a
      >
      <a
        href="/how-it-works"
        class="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
        >How It Works</a
      >
      <a
        href="/faq"
        class="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
        >FAQ</a
      >

      <div class="flex items-center gap-3 ml-auto">
        {#if session?.user}
          <a
            href="/home"
            class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Go to App &rarr;
          </a>
        {:else}
          <a
            href="/login"
            class="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition font-medium"
          >
            Sign in
          </a>
          <a
            href="/create?type=counter"
            class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Get Started
          </a>
        {/if}
        <ThemeToggle />
      </div>
    </div>
  </div>

  <!-- Mobile menu -->
  {#if mobileMenuOpen}
    <div
      class="md:hidden absolute left-0 right-0 top-full z-50 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg dark:shadow-slate-900/50"
    >
      <div class="px-4 py-3 space-y-1">
        <a
          href="/features"
          onclick={() => (mobileMenuOpen = false)}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <ion-icon name="sparkles-outline" style="font-size: 18px;"></ion-icon>
          <span>Features</span>
        </a>
        <a
          href="/use-cases"
          onclick={() => (mobileMenuOpen = false)}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <ion-icon name="people-outline" style="font-size: 18px;"></ion-icon>
          <span>Use Cases</span>
        </a>
        <a
          href="/how-it-works"
          onclick={() => (mobileMenuOpen = false)}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <ion-icon name="list-outline" style="font-size: 18px;"></ion-icon>
          <span>How It Works</span>
        </a>
        <a
          href="/faq"
          onclick={() => (mobileMenuOpen = false)}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <ion-icon name="help-circle-outline" style="font-size: 18px;"
          ></ion-icon>
          <span>FAQ</span>
        </a>
        <div class="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
          {#if session?.user}
            <a
              href="/home"
              onclick={() => (mobileMenuOpen = false)}
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
            >
              <ion-icon name="home-outline" style="font-size: 18px;"></ion-icon>
              <span>Go to App</span>
            </a>
          {:else}
            <a
              href="/login"
              onclick={() => (mobileMenuOpen = false)}
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <ion-icon name="log-in-outline" style="font-size: 18px;"
              ></ion-icon>
              <span>Sign in</span>
            </a>
            <a
              href="/create?type=counter"
              onclick={() => (mobileMenuOpen = false)}
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
            >
              <ion-icon name="add-circle-outline" style="font-size: 18px;"
              ></ion-icon>
              <span>Get Started</span>
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</nav>

<main class="flex-1">
  {@render children()}
</main>

<SiteFooter version={data.buildInfo.version} commit={data.buildInfo.commit} />
