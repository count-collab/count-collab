<script lang="ts">
  import { signOut } from "@auth/sveltekit/client";
  import { afterNavigate, goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import InvitationHint from "$lib/components/InvitationHint.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import ToastContainer, {
    addInvitationToast,
    addMessageToast,
  } from "$lib/components/ToastContainer.svelte";
  import {
    type InvitationPayload,
    onInvitationCreated,
    onInvitationDeleted,
    onInvitationUpdated,
  } from "$lib/stores/invitations";
  import { subscribeRoom } from "$lib/stores/socket";
  import {
    onTeamMembershipChanged,
    type TeamMembershipChangedPayload,
  } from "$lib/stores/teams";

  const { children, data } = $props();
  const session = $derived(data.session);
  const isAdmin = $derived(data.isAdmin);
  const hasPendingInvitations = $derived(data.pendingInvitationCount > 0);

  let mobileMenuOpen = $state(false);
  let accountMenuOpen = $state(false);
  let navigation: HTMLElement;
  let mobileMenuButton: HTMLButtonElement;
  let accountMenuButton = $state<HTMLButtonElement>();

  function isCurrent(href: string) {
    const path = page.url.pathname;
    return path === href || (href !== "/my" && path.startsWith(`${href}/`));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (mobileMenuOpen) {
      mobileMenuOpen = false;
      mobileMenuButton.focus();
    } else if (accountMenuOpen) {
      accountMenuOpen = false;
      accountMenuButton?.focus();
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.target instanceof Node && !navigation.contains(event.target)) {
      mobileMenuOpen = false;
      accountMenuOpen = false;
    }
  }

  function handleResize() {
    if (window.matchMedia("(min-width: 768px)").matches) {
      mobileMenuOpen = false;
    } else {
      accountMenuOpen = false;
    }
  }

  afterNavigate(() => {
    mobileMenuOpen = false;
    accountMenuOpen = false;
  });

  function handleInvitationChange(payload: InvitationPayload) {
    if (payload.userId === session?.user?.id) {
      invalidateAll();
    }
  }

  function handleTeamMembershipChange(payload: TeamMembershipChangedPayload) {
    const teamPath = `/t/${payload.teamId}`;
    const { pathname } = page.url;
    const onTeamPage =
      pathname === teamPath || pathname.startsWith(`${teamPath}/`);

    // Changes to other members arrive through the team room we joined on this page
    if (payload.userId !== session?.user?.id) {
      if (onTeamPage) invalidateAll();
      return;
    }

    const lostAccess =
      payload.reason === "removed" || payload.reason === "team_deleted";

    if (onTeamPage && lostAccess) {
      addMessageToast(
        payload.reason === "team_deleted"
          ? "This team was deleted."
          : "You are no longer a member of this team.",
      );
      goto("/my/teams", { invalidateAll: true });
      return;
    }

    invalidateAll();
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
    const unsubTeam = onTeamMembershipChanged(handleTeamMembershipChange);

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubTeam();
    };
  });

  // Team room delivers changes to other members while viewing a team page
  const viewedTeamId = $derived(
    /^\/t\/([0-9a-f-]{36})(?:\/|$)/i.exec(page.url.pathname)?.[1] ?? null,
  );

  $effect(() => {
    if (!viewedTeamId || !session?.user?.id) return;

    return subscribeRoom("team", viewedTeamId);
  });
</script>

<svelte:window
  onkeydown={handleKeydown}
  onpointerdown={handlePointerDown}
  onresize={handleResize}
/>

<nav
  bind:this={navigation}
  aria-label="Main navigation"
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
        class="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        aria-label="Create counter"
      >
        <ion-icon name="add-outline" style="font-size: 22px;"></ion-icon>
      </a>
      <div class="relative">
        <button
          bind:this={mobileMenuButton}
          type="button"
          onclick={() => {
            accountMenuOpen = false;
            mobileMenuOpen = !mobileMenuOpen;
          }}
          class="relative inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          aria-describedby={hasPendingInvitations
            ? "mobile-invitation-count"
            : undefined}
        >
          {#if mobileMenuOpen}
            <ion-icon name="close-outline" style="font-size: 24px;"></ion-icon>
          {:else}
            <ion-icon name="menu-outline" style="font-size: 24px;"></ion-icon>
          {/if}
          {#if hasPendingInvitations}
            <span
              aria-hidden="true"
              class="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-blue-600"
            ></span>
          {/if}
        </button>
        {#if session?.user && hasPendingInvitations}
          <span id="mobile-invitation-count" class="sr-only">
            {data.pendingInvitationCount} pending {data.pendingInvitationCount ===
            1
              ? "invitation"
              : "invitations"}
          </span>
          <InvitationHint count={data.pendingInvitationCount} />
        {/if}
      </div>
    </div>

    <!-- Desktop nav -->
    <div class="hidden md:flex items-center gap-4 flex-1 ml-8">
      <a
        href="/counters"
        aria-current={isCurrent("/counters") ? "page" : undefined}
        class="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 aria-[current=page]:font-semibold aria-[current=page]:text-blue-600 dark:aria-[current=page]:text-blue-400 transition"
        >Counters</a
      >
      <a
        href="/dashboards"
        aria-current={isCurrent("/dashboards") ? "page" : undefined}
        class="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 aria-[current=page]:font-semibold aria-[current=page]:text-blue-600 dark:aria-[current=page]:text-blue-400 transition"
        >Dashboards</a
      >
      {#if session?.user}
        <a
          href="/my/teams"
          aria-current={isCurrent("/my/teams") ? "page" : undefined}
          class="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 aria-[current=page]:font-semibold aria-[current=page]:text-blue-600 dark:aria-[current=page]:text-blue-400 transition"
        >
          Teams
          <span
            class="rounded-full bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-blue-700 dark:text-blue-300"
            >New</span
          >
        </a>
      {/if}
      <div class="flex items-center gap-3 ml-auto">
        {#if session?.user}
          <div class="relative">
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
            <InvitationHint count={data.pendingInvitationCount} />
          </div>
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
              bind:this={accountMenuButton}
              type="button"
              onclick={() => {
                mobileMenuOpen = false;
                accountMenuOpen = !accountMenuOpen;
              }}
              aria-expanded={accountMenuOpen}
              aria-controls="account-navigation"
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
                {session.user.username ?? "User"}
              </span>
              <svg
                class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform {accountMenuOpen
                  ? 'rotate-180'
                  : ''}"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"><path d="M19 9l-7 7-7-7" /></svg
              >
            </button>
            <div
              id="account-navigation"
              hidden={!accountMenuOpen}
              class="absolute right-0 top-full mt-1 w-60 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-slate-900/50 py-1 z-50"
            >
              <a
                href="/my"
                aria-current={isCurrent("/my") ? "page" : undefined}
                class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <ion-icon
                  name="grid-outline"
                  class="shrink-0"
                  style="font-size: 18px;"
                ></ion-icon>
                <span class="whitespace-nowrap">My Overview</span>
              </a>
              <a
                href="/settings"
                aria-current={isCurrent("/settings") ? "page" : undefined}
                class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <ion-icon name="settings-outline" style="font-size: 16px;"
                ></ion-icon>
                Settings
              </a>
              {#if isAdmin}
                <a
                  href="/admin"
                  aria-current={isCurrent("/admin") ? "page" : undefined}
                  class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <ion-icon name="shield-outline" style="font-size: 16px;"
                  ></ion-icon>
                  Admin
                </a>
              {/if}
              <ThemeToggle variant="desktop-menu" />
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
          <ThemeToggle />
        {/if}
      </div>
    </div>
  </div>

  <!-- Mobile menu dropdown (overlay) -->
  <div
    id="mobile-navigation"
    hidden={!mobileMenuOpen}
    class="md:hidden absolute left-0 right-0 top-full z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg dark:shadow-slate-900/50"
  >
    <div class="px-4 py-3 space-y-1">
      <p
        class="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        Explore
      </p>
      <a
        href="/counters"
        aria-current={isCurrent("/counters") ? "page" : undefined}
        onclick={() => (mobileMenuOpen = false)}
        class="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 dark:aria-[current=page]:bg-blue-900/30 dark:aria-[current=page]:text-blue-300 transition"
      >
        <ion-icon name="trending-up-outline" style="font-size: 18px;"
        ></ion-icon>
        <span>Counters</span>
      </a>
      <a
        href="/dashboards"
        aria-current={isCurrent("/dashboards") ? "page" : undefined}
        onclick={() => (mobileMenuOpen = false)}
        class="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 dark:aria-[current=page]:bg-blue-900/30 dark:aria-[current=page]:text-blue-300 transition"
      >
        <ion-icon name="grid-outline" style="font-size: 18px;"></ion-icon>
        <span>Dashboards</span>
      </a>
      {#if session?.user}
        <a
          href="/my/teams"
          aria-current={isCurrent("/my/teams") ? "page" : undefined}
          onclick={() => (mobileMenuOpen = false)}
          class="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 dark:aria-[current=page]:bg-blue-900/30 dark:aria-[current=page]:text-blue-300 transition"
        >
          <ion-icon name="people-outline" style="font-size: 18px;"></ion-icon>
          <span>Teams</span>
          <span
            class="rounded-full bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-blue-700 dark:text-blue-300"
            >New</span
          >
        </a>
      {/if}
      {#if session?.user}
        <div class="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
          <p
            class="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Account
          </p>
        </div>
        <a
          href="/invitations"
          aria-current={isCurrent("/invitations") ? "page" : undefined}
          onclick={() => (mobileMenuOpen = false)}
          class="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 dark:aria-[current=page]:bg-blue-900/30 dark:aria-[current=page]:text-blue-300 transition"
        >
          <ion-icon name="notifications-outline" style="font-size: 18px;"
          ></ion-icon>
          <span>Invitations</span>
          {#if hasPendingInvitations}
            <span
              class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            >
              {data.pendingInvitationCount} pending
            </span>
          {/if}
        </a>
        <a
          href="/my"
          aria-current={isCurrent("/my") ? "page" : undefined}
          onclick={() => (mobileMenuOpen = false)}
          class="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 dark:aria-[current=page]:bg-blue-900/30 dark:aria-[current=page]:text-blue-300 transition"
        >
          <ion-icon name="grid-outline" style="font-size: 18px;"></ion-icon>
          <span class="whitespace-nowrap">My Overview</span>
        </a>
        <a
          href="/settings"
          aria-current={isCurrent("/settings") ? "page" : undefined}
          onclick={() => (mobileMenuOpen = false)}
          class="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 dark:aria-[current=page]:bg-blue-900/30 dark:aria-[current=page]:text-blue-300 transition"
        >
          <ion-icon name="settings-outline" style="font-size: 18px;"></ion-icon>
          <span>Settings</span>
        </a>
        {#if isAdmin}
          <a
            href="/admin"
            aria-current={isCurrent("/admin") ? "page" : undefined}
            onclick={() => (mobileMenuOpen = false)}
            class="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-blue-700 dark:aria-[current=page]:bg-blue-900/30 dark:aria-[current=page]:text-blue-300 transition"
          >
            <ion-icon name="shield-outline" style="font-size: 18px;"></ion-icon>
            <span>Admin</span>
          </a>
        {/if}
        <button
          type="button"
          onclick={() => {
            mobileMenuOpen = false;
            signOut();
          }}
          class="flex min-h-11 items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          <ion-icon name="log-out-outline" style="font-size: 18px;"></ion-icon>
          <span>Sign out</span>
        </button>
      {:else}
        <div class="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
          <a
            href="/login"
            onclick={() => (mobileMenuOpen = false)}
            class="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
          >
            <ion-icon name="log-in-outline" style="font-size: 18px;"></ion-icon>
            <span>Sign in</span>
          </a>
        </div>
      {/if}
      <div class="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
        <ThemeToggle variant="menu" />
      </div>
    </div>
  </div>
</nav>

<main
  class="flex-1 flex flex-col max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full"
>
  {@render children()}
</main>

<SiteFooter version={data.buildInfo.version} commit={data.buildInfo.commit} />

<ToastContainer />
