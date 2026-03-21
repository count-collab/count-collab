<script lang="ts">
  import { signOut } from "@auth/sveltekit/client";
  import { addIcons } from "ionicons";
  import { defineCustomElement } from "ionicons/components/ion-icon.js";
  import {
    addCircleOutline,
    addOutline,
    checkmarkOutline,
    closeOutline,
    copyOutline,
    createOutline,
    ellipsisVertical,
    gridOutline,
    homeOutline,
    listOutline,
    logInOutline,
    logOutOutline,
    logoDiscord,
    logoGoogle,
    logoTwitch,
    menuOutline,
    shareSocialOutline,
    shieldOutline,
    trashOutline,
  } from "ionicons/icons";
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import CreateFab from "$lib/components/CreateFab.svelte";
  import "../app.css";

  if (browser) {
    addIcons({
      "add-outline": addOutline,
      "close-outline": closeOutline,
      "menu-outline": menuOutline,
      "home-outline": homeOutline,
      "grid-outline": gridOutline,
      "add-circle-outline": addCircleOutline,
      "list-outline": listOutline,
      "shield-outline": shieldOutline,
      "log-out-outline": logOutOutline,
      "log-in-outline": logInOutline,
      "share-social-outline": shareSocialOutline,
      "create-outline": createOutline,
      "trash-outline": trashOutline,
      "ellipsis-vertical": ellipsisVertical,
      "copy-outline": copyOutline,
      "checkmark-outline": checkmarkOutline,
      "logo-google": logoGoogle,
      "logo-discord": logoDiscord,
      "logo-twitch": logoTwitch,
    });
    defineCustomElement();
  }

  const { children, data } = $props();
  const session = $derived(data.session);
  const isAdmin = $derived(data.isAdmin);

  let mobileMenuOpen = $state(false);

  const hideFabRoutes = ["/create", "/login", "/setup"];
  const showFab = $derived(
    !hideFabRoutes.some((r) => page.url.pathname.startsWith(r)) &&
      !page.url.pathname.startsWith("/c/"),
  );
</script>

<div
  class="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100"
>
  <nav
    class="sticky top-0 z-20 relative bg-white/90 backdrop-blur shadow-sm border-b border-slate-200"
  >
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"
    >
      <h1 class="text-2xl font-bold">
        <a href="/" class="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Count Collab
        </a>
      </h1>

      <!-- Mobile: hamburger + create button -->
      <div class="flex items-center gap-2 md:hidden">
        <a
          href="/create"
          class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          aria-label="Create counter"
        >
          <ion-icon name="add-outline" style="font-size: 22px;"></ion-icon>
        </a>
        <button
          type="button"
          onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
          class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-700 hover:bg-slate-100 transition"
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
      <div class="hidden md:flex items-center gap-4">
        <a href="/" class="text-slate-700 hover:text-slate-900 transition"
          >Home</a
        >
        <a
          href="/counters"
          class="text-slate-700 hover:text-slate-900 transition">Browse</a
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
          {#if isAdmin}
            <a
              href="/admin"
              class="text-slate-700 hover:text-slate-900 transition">Admin</a
            >
          {/if}
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
            class="ml-2 px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Sign in
          </a>
        {/if}
      </div>
    </div>

    <!-- Mobile menu dropdown (overlay) -->
    {#if mobileMenuOpen}
      <div
        class="md:hidden absolute left-0 right-0 top-full z-50 border-t border-slate-200 bg-white shadow-lg"
      >
        <div class="px-4 py-3 space-y-1">
          <a
            href="/"
            onclick={() => (mobileMenuOpen = false)}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition"
          >
            <ion-icon name="home-outline" style="font-size: 18px;"></ion-icon>
            <span>Home</span>
          </a>
          <a
            href="/counters"
            onclick={() => (mobileMenuOpen = false)}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition"
          >
            <ion-icon name="grid-outline" style="font-size: 18px;"></ion-icon>
            <span>Browse</span>
          </a>
          <a
            href="/create"
            onclick={() => (mobileMenuOpen = false)}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition"
          >
            <ion-icon name="add-circle-outline" style="font-size: 18px;"
            ></ion-icon>
            <span>Create</span>
          </a>

          {#if session?.user}
            <a
              href="/my-counters"
              onclick={() => (mobileMenuOpen = false)}
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition"
            >
              <ion-icon name="list-outline" style="font-size: 18px;"></ion-icon>
              <span>My Counters</span>
            </a>
            {#if isAdmin}
              <a
                href="/admin"
                onclick={() => (mobileMenuOpen = false)}
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition"
              >
                <ion-icon name="shield-outline" style="font-size: 18px;"
                ></ion-icon>
                <span>Admin</span>
              </a>
            {/if}
            <div class="border-t border-slate-200 mt-2 pt-2">
              <div class="flex items-center gap-2 px-3 py-2">
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
              </div>
              <button
                type="button"
                onclick={() => {
                  mobileMenuOpen = false;
                  signOut();
                }}
                class="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition"
              >
                <ion-icon name="log-out-outline" style="font-size: 18px;"
                ></ion-icon>
                <span>Sign out</span>
              </button>
            </div>
          {:else}
            <div class="border-t border-slate-200 mt-2 pt-2">
              <a
                href="/login"
                onclick={() => (mobileMenuOpen = false)}
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-blue-600 font-semibold hover:bg-blue-50 transition"
              >
                <ion-icon name="log-in-outline" style="font-size: 18px;"
                ></ion-icon>
                <span>Sign in</span>
              </a>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </nav>

  <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
    {@render children()}
  </main>

  {#if showFab}
    <CreateFab />
  {/if}

  <footer class="bg-white border-t border-slate-200 mt-12 py-8">
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-600"
    >
      <p>&copy; 2026 Count Collab. Shared counts for everyone.</p>
      <p class="mt-1 text-xs text-slate-400">
        v{data.buildInfo.version} · {data.buildInfo.commit}
      </p>
    </div>
  </footer>
</div>
