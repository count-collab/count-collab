<script lang="ts">
  import { signOut } from "@auth/sveltekit/client";
  import "../app.css";

  const { children, data } = $props();
  const session = $derived(data.session);
</script>

<div
  class="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100"
>
  <nav
    class="sticky top-0 z-20 bg-white/90 backdrop-blur shadow-sm border-b border-slate-200"
  >
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"
    >
      <h1 class="text-2xl font-bold text-slate-900">
        <a href="/">Count Collab</a>
      </h1>
      <div class="flex items-center gap-4">
        <a href="/" class="text-slate-700 hover:text-slate-900 transition"
          >Home</a
        >
        <a
          href="/counters"
          class="text-slate-700 hover:text-slate-900 transition">Browser</a
        >
        <a href="/create" class="text-slate-700 hover:text-slate-900 transition"
          >Create</a
        >

        {#if session?.user}
          <a
            href="/my-counters"
            class="text-slate-700 hover:text-slate-900 transition"
            >My Counters</a
          >
          <div
            class="flex items-center gap-2 ml-2 pl-4 border-l border-slate-200"
          >
            {#if session.user.image}
              <img
                src={session.user.image}
                alt=""
                class="w-7 h-7 rounded-full"
              />
            {/if}
            <span class="text-sm font-medium text-slate-700">
              {session.user.username ?? session.user.name ?? "User"}
            </span>
            <button
              type="button"
              onclick={() => signOut()}
              class="text-sm text-slate-500 hover:text-slate-700 transition ml-1"
            >
              Sign out
            </button>
          </div>
        {:else}
          <a
            href="/login"
            class="ml-2 px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Sign in
          </a>
        {/if}
      </div>
    </div>
  </nav>

  <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
    {@render children()}
  </main>

  <footer class="bg-white border-t border-slate-200 mt-12 py-8">
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-600"
    >
      <p>&copy; 2026 Count Collab. Shared counts for everyone.</p>
    </div>
  </footer>
</div>
