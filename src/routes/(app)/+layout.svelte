<script lang="ts">
  import { signOut } from "@auth/sveltekit/client";
  import { invalidateAll } from "$app/navigation";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import ToastContainer, {
    addInvitationToast,
  } from "$lib/components/ToastContainer.svelte";
  import {
    type InvitationPayload,
    onInvitationCreated,
    onInvitationDeleted,
    onInvitationUpdated,
  } from "$lib/stores/invitations";

  const { children, data } = $props();
  const session = $derived(data.session);
  const isAdmin = $derived(data.isAdmin);
  const hasPendingInvitations = $derived(data.pendingInvitationCount > 0);

  let mobileMenuOpen = $state(false);

  function handleInvitationChange(payload: InvitationPayload) {
    if (payload.userId === session?.user?.id) {
      invalidateAll();
    }
  }

  $effect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    const unsubCreated = onInvitationCreated((payload) => {
      if (payload.userId === userId) {
        addInvitationToast(payload);
        invalidateAll();
      }
    });
    const unsubUpdated = onInvitationUpdated(handleInvitationChange);
    const unsubDeleted = onInvitationDeleted(handleInvitationChange);

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  });
</script>

<nav
  class="sticky top-0 z-20 relative bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm dark:shadow-slate-900/50 border-b border-slate-200 dark:border-slate-700"
>
  <div
    class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"
  >
    <h1 class="text-2xl font-bold">
      <a
        href="/home"
        class="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent"
      >
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
      {#if session?.user}
        <a
          href="/invitations"
          class="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Invitations"
        >
          <ion-icon name="notifications-outline" style="font-size: 20px;"
          ></ion-icon>
          {#if hasPendingInvitations}
            <span
              class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
            ></span>
          {/if}
        </a>
      {/if}
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
    <div class="hidden md:flex items-center gap-4 flex-1 ml-8">
      <a
        href="/counters"
        class="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
        >Counters</a
      >
      <a
        href="/dashboards"
        class="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
        >Dashboards</a
      >
      <div class="flex items-center gap-3 ml-auto">
        {#if session?.user}
          <a
            href="/invitations"
            class="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Invitations"
          >
            <ion-icon name="notifications-outline" style="font-size: 20px;"
            ></ion-icon>
            {#if hasPendingInvitations}
              <span
                class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
              ></span>
            {/if}
          </a>
        {/if}
        <a
          href="/create"
          class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
          Create
        </a>

        {#if session?.user}
          <div
            class="relative pl-3 border-l border-slate-200 dark:border-slate-700 group"
          >
            <button
              type="button"
              class="flex items-center gap-2 py-1 hover:opacity-80 transition cursor-pointer"
            >
              {#if session.user.image}
                <img
                  src={session.user.image}
                  alt=""
                  class="w-7 h-7 rounded-full"
                />
              {/if}
              <span
                class="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {session.user.username ?? session.user.name ?? "User"}
              </span>
              <svg
                class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform group-hover:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"><path d="M19 9l-7 7-7-7" /></svg
              >
            </button>
            <div
              class="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute right-0 top-full mt-1 w-60 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/50 py-1 transition-all duration-150 z-50"
            >
              <a
                href="/my-counters"
                class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <ion-icon
                  name="list-outline"
                  class="shrink-0"
                  style="font-size: 18px;"
                ></ion-icon>
                <span class="whitespace-nowrap">My Counters & Dashboards</span>
              </a>
              <a
                href="/settings"
                class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <ion-icon name="settings-outline" style="font-size: 16px;"
                ></ion-icon>
                Settings
              </a>
              {#if isAdmin}
                <a
                  href="/admin"
                  class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <ion-icon name="shield-outline" style="font-size: 16px;"
                  ></ion-icon>
                  Admin
                </a>
              {/if}
              <div
                class="border-t border-slate-100 dark:border-slate-700 my-1"
              ></div>
              <button
                type="button"
                onclick={() => signOut()}
                class="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
              >
                <ion-icon name="log-out-outline" style="font-size: 16px;"
                ></ion-icon>
                Sign out
              </button>
            </div>
          </div>
        {:else}
          <a
            href="/login"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Sign in
          </a>
        {/if}

        <ThemeToggle />
      </div>
    </div>
  </div>

  <!-- Mobile menu dropdown (overlay) -->
  {#if mobileMenuOpen}
    <div
      class="md:hidden absolute left-0 right-0 top-full z-50 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg dark:shadow-slate-900/50"
    >
      <div class="px-4 py-3 space-y-1">
        <a
          href="/counters"
          onclick={() => (mobileMenuOpen = false)}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <ion-icon name="trending-up-outline" style="font-size: 18px;"
          ></ion-icon>
          <span>Counters</span>
        </a>
        <a
          href="/dashboards"
          onclick={() => (mobileMenuOpen = false)}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <ion-icon name="grid-outline" style="font-size: 18px;"></ion-icon>
          <span>Dashboards</span>
        </a>
        <a
          href="/create"
          onclick={() => (mobileMenuOpen = false)}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <ion-icon name="add-circle-outline" style="font-size: 18px;"
          ></ion-icon>
          <span>Create</span>
        </a>

        {#if session?.user}
          <a
            href="/invitations"
            onclick={() => (mobileMenuOpen = false)}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ion-icon name="notifications-outline" style="font-size: 18px;"
            ></ion-icon>
            <span>Invitations</span>
            {#if hasPendingInvitations}
              <span
                class="w-2 h-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
              ></span>
            {/if}
          </a>
          <a
            href="/my-counters"
            onclick={() => (mobileMenuOpen = false)}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ion-icon name="list-outline" style="font-size: 18px;"></ion-icon>
            <span class="whitespace-nowrap">My Counters & Dashboards</span>
          </a>
          <a
            href="/settings"
            onclick={() => (mobileMenuOpen = false)}
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ion-icon name="settings-outline" style="font-size: 18px;"
            ></ion-icon>
            <span>Settings</span>
          </a>
          {#if isAdmin}
            <a
              href="/admin"
              onclick={() => (mobileMenuOpen = false)}
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <ion-icon name="shield-outline" style="font-size: 18px;"
              ></ion-icon>
              <span>Admin</span>
            </a>
          {/if}
          <div
            class="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2"
          >
            <a
              href="/my-counters"
              onclick={() => (mobileMenuOpen = false)}
              class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              {#if session.user.image}
                <img
                  src={session.user.image}
                  alt=""
                  class="w-7 h-7 rounded-full"
                />
              {/if}
              <span
                class="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {session.user.username ?? session.user.name ?? "User"}
              </span>
            </a>
            <button
              type="button"
              onclick={() => {
                mobileMenuOpen = false;
                signOut();
              }}
              class="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              <ion-icon name="log-out-outline" style="font-size: 18px;"
              ></ion-icon>
              <span>Sign out</span>
            </button>
          </div>
        {:else}
          <div
            class="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2"
          >
            <a
              href="/login"
              onclick={() => (mobileMenuOpen = false)}
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
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

<main
  class="flex-1 flex flex-col max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full"
>
  {@render children()}
</main>

<SiteFooter version={data.buildInfo.version} commit={data.buildInfo.commit} />

<ToastContainer />
