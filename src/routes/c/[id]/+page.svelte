<script lang="ts">
  import { browser } from "$app/environment";
  import { goto, invalidate } from "$app/navigation";
  import CounterBadges from "$lib/components/CounterBadges.svelte";
  import Fireworks from "$lib/components/Fireworks.svelte";
  import HistoryEntry from "$lib/components/HistoryEntry.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import RollingNumber from "$lib/components/RollingNumber.svelte";
  import Sparkline from "$lib/components/Sparkline.svelte";
  import type { CounterMemberRole, CounterVisibilityMode } from "$lib/db/schema";
  import { onCounterUpdated } from "$lib/stores/counters";
  import { rateLimit } from "$lib/stores/ratelimit";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
  const visibilityLabels: Record<CounterVisibilityMode, string> = {
    public: "Public",
    public_readonly: "Public",
    private: "Private",
  };
  const visibilityDescriptions: Record<CounterVisibilityMode, string> = {
    public: "Anyone with the link can view and increment.",
    public_readonly: "Anyone can view. Only invited members can increment.",
    private: "Only invited members or people with the private link can access it.",
  };
  const visibilityBadgeClasses: Record<CounterVisibilityMode, string> = {
    public: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    public_readonly: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    private: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };
  const memberRoleLabels: Record<CounterMemberRole, string> = {
    viewer: "Viewer",
    incrementer: "Incrementer",
    editor: "Editor",
    admin: "Admin",
  };

  function getVisibilityMode(): CounterVisibilityMode {
    return data.counter.visibilityMode ?? (data.counter.isPublic ? "public" : "private");
  }

  function getRoleLabel(role: string): string {
    return memberRoleLabels[role as CounterMemberRole] ?? role;
  }

  const visibilityMode = $derived(getVisibilityMode());
  const incrementUnavailableMessage = $derived.by(() => {
    if (data.canIncrement) {
      return null;
    }

    if (visibilityMode === "public_readonly") {
      return visibilityDescriptions.public_readonly;
    }

    return "You can view this counter, but you can't increment it.";
  });

  let optimisticCount = $state<number | null>(null);
  let optimisticUpdatedAt = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  let isIncrementing = $state(false);
  let fireworkTrigger = $state(0);

  // History toggle state
  const COLLAPSED_HISTORY_COUNT = 5;
  let historyExpanded = $state(false);
  const visibleHistory = $derived(
    historyExpanded
      ? data.history
      : data.history.slice(0, COLLAPSED_HISTORY_COUNT),
  );

  // Edit modal state
  let showEditModal = $state(false);
  let editTitle = $state("");
  let editDescription = $state("");
  let editVisibility = $state<CounterVisibilityMode>("public");
  let editError = $state<string | null>(null);
  let isSaving = $state(false);

  // Delete confirmation state
  let showDeleteConfirm = $state(false);
  let isDeleting = $state(false);

  // Share modal state
  let showShareModal = $state(false);
  let copySuccess = $state(false);

  // Actions dropdown state
  let showActionsMenu = $state(false);



  const shareUrl = $derived.by(() => {
    const base = browser
      ? `${window.location.origin}/c/${data.counter.id}`
      : `/c/${data.counter.id}`;
    if (!data.counter.isPublic && data.shareToken) {
      return `${base}?token=${data.shareToken}`;
    }
    return base;
  });

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copySuccess = true;
      setTimeout(() => (copySuccess = false), 2000);
    } catch {
      // fallback: already selected via select-all
    }
  }

  // Member invitation state
  let inviteUsername = $state("");
  let inviteRole = $state<CounterMemberRole>("viewer");
  let inviteError = $state<string | null>(null);
  let inviteSuccess = $state<string | null>(null);
  let isInviting = $state(false);

  const displayCount = $derived(optimisticCount ?? data.counter.count);
  const displayUpdatedAt = $derived(
    optimisticUpdatedAt ?? data.counter.updatedAt,
  );

  async function handleIncrement() {
    if (isIncrementing) return;

    if (!data.canIncrement) {
      errorMessage = incrementUnavailableMessage;
      return;
    }

    if ($rateLimit.isLimited) {
      errorMessage = `Please wait ${$rateLimit.retryAfterSeconds}s before incrementing again.`;
      return;
    }

    isIncrementing = true;
    errorMessage = null;

    try {
      let incrementUrl = `/api/counters/${data.counter.id}`;
      // Pass the share token from the current URL if present (for token-based access)
      if (browser) {
        const currentToken = new URL(window.location.href).searchParams.get(
          "token",
        );
        if (currentToken) {
          incrementUrl += `?token=${encodeURIComponent(currentToken)}`;
        }
      }
      const response = await fetch(incrementUrl, { method: "POST" });

      if (!response.ok) {
        const body = await response.json();

        if (response.status === 429) {
          const retryAfter = body.retryAfterSeconds ?? 5;
          rateLimit.setLimit(`/api/counters/${data.counter.id}`, retryAfter);
          errorMessage = `Please wait ${retryAfter}s before incrementing again.`;
          return;
        }

        errorMessage = body.error ?? "Failed to increment counter.";
        return;
      }

      const result: {
        count: number;
        updatedAt: string;
        cooldownSeconds: number;
      } = await response.json();
      optimisticCount = result.count;
      optimisticUpdatedAt = result.updatedAt;
      fireworkTrigger++;
      if (result.cooldownSeconds > 0) {
        rateLimit.setLimit(`/c/${data.counter.id}`, result.cooldownSeconds);
      }
      await invalidate(`counter:${data.counter.id}`);
      optimisticCount = null;
      optimisticUpdatedAt = null;
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      isIncrementing = false;
    }
  }

  async function handleSaveEdit() {
    if (isSaving) return;
    isSaving = true;
    editError = null;

    try {
      const response = await fetch(`/api/counters/${data.counter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          visibility: editVisibility,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        editError = body.error ?? "Failed to update counter.";
        return;
      }

      showEditModal = false;
      invalidate(`counter:${data.counter.id}`);
    } catch {
      editError = "Network error. Please try again.";
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete() {
    if (isDeleting) return;
    isDeleting = true;

    try {
      const response = await fetch(`/api/counters/${data.counter.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json();
        errorMessage = body.error ?? "Failed to delete counter.";
        showDeleteConfirm = false;
        return;
      }

      await goto("/");
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      isDeleting = false;
      showDeleteConfirm = false;
    }
  }

  async function handleInvite() {
    if (isInviting || !inviteUsername.trim()) return;
    isInviting = true;
    inviteError = null;
    inviteSuccess = null;

    try {
      const response = await fetch(`/c/${data.counter.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inviteUsername, role: inviteRole }),
      });

      if (!response.ok) {
        const body = await response.json();
        inviteError = body.error ?? "Failed to invite user.";
        return;
      }

      inviteSuccess = `Invited ${inviteUsername} as ${getRoleLabel(inviteRole)}`;
      inviteUsername = "";
      invalidate(`counter:${data.counter.id}`);
    } catch {
      inviteError = "Network error. Please try again.";
    } finally {
      isInviting = false;
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const response = await fetch(`/c/${data.counter.id}/members/${userId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        invalidate(`counter:${data.counter.id}`);
      }
    } catch {
      // silently fail
    }
  }

  $effect(() => {
    if (!$rateLimit.isLimited && errorMessage) {
      errorMessage = null;
    }
  });

  $effect(() => {
    if (!browser) return;

    const unsubscribe = onCounterUpdated((payload) => {
      if (payload.counterId !== data.counter.id) return;
      if (isIncrementing) return;

      fireworkTrigger++;
      invalidate(`counter:${data.counter.id}`).then(() => {
        optimisticCount = null;
        optimisticUpdatedAt = null;
      });
    });

    return unsubscribe;
  });
</script>

<MetaTags
  title={data.title}
  description={data.description}
  path="/c/{data.counter.id}"
  image="/api/og/{data.counter.id}"
/>


<div class="flex flex-col min-h-[calc(100vh-8rem)]">
  <!-- Header bar -->
  <header class="pb-4">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 break-words">
          {data.counter.title}
        </h1>
        {#if data.counter.description}
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5 break-words">
            {data.counter.description}
          </p>
        {/if}
      </div>

      <!-- Desktop action buttons -->
      <div class="hidden sm:flex gap-2 shrink-0 ml-4">
        {#if data.canManage}
          <button
            type="button"
            onclick={() => (showShareModal = true)}
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            <ion-icon name="share-social-outline" style="font-size: 16px;"
            ></ion-icon>
            Share
          </button>
        {/if}
        {#if data.canEdit}
          <button
            type="button"
            onclick={() => {
              editTitle = data.counter.title;
              editDescription = data.counter.description ?? "";
              editVisibility = visibilityMode;
              showEditModal = true;
            }}
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            <ion-icon name="create-outline" style="font-size: 16px;"></ion-icon>
            Edit
          </button>
        {/if}
        {#if data.canDelete}
          <button
            type="button"
            onclick={() => (showDeleteConfirm = true)}
            class="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition inline-flex items-center gap-1.5 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <ion-icon name="trash-outline" style="font-size: 16px;"></ion-icon>
            Delete
          </button>
        {/if}
      </div>

      <!-- Mobile actions dropdown -->
      {#if data.canManage || data.canEdit || data.canDelete}
        <div class="relative sm:hidden shrink-0">
          <button
            type="button"
            onclick={() => (showActionsMenu = !showActionsMenu)}
            class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 transition dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Counter actions"
          >
            <ion-icon name="ellipsis-vertical" style="font-size: 20px;"
            ></ion-icon>
          </button>
          {#if showActionsMenu}
            <!-- Backdrop to close menu -->
            <button
              type="button"
              class="fixed inset-0 z-40"
              aria-label="Close menu"
              onclick={() => (showActionsMenu = false)}
            ></button>
            <div
              class="absolute right-0 top-full mt-1 z-50 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 dark:bg-slate-800 dark:shadow-slate-900/50 dark:border-slate-700"
            >
              {#if data.canManage}
                <button
                  type="button"
                  onclick={() => {
                    showActionsMenu = false;
                    showShareModal = true;
                  }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <ion-icon name="share-social-outline" style="font-size: 16px;"
                  ></ion-icon>
                  Share
                </button>
              {/if}
              {#if data.canEdit}
                <button
                  type="button"
                  onclick={() => {
                    showActionsMenu = false;
                    editTitle = data.counter.title;
                    editDescription = data.counter.description ?? "";
                    editVisibility = visibilityMode;
                    showEditModal = true;
                  }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <ion-icon name="create-outline" style="font-size: 16px;"
                  ></ion-icon>
                  Edit
                </button>
              {/if}
              {#if data.canDelete}
                <button
                  type="button"
                  onclick={() => {
                    showActionsMenu = false;
                    showDeleteConfirm = true;
                  }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <ion-icon name="trash-outline" style="font-size: 16px;"
                  ></ion-icon>
                  Delete
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Tags row -->
    <div class="flex flex-wrap items-center gap-2 mt-2">
      <CounterBadges
        visibilityMode={visibilityMode}
        ownership={data.isOwner ? "owner" : null}
        containerClass="flex flex-wrap items-center gap-2"
        visibilityLabels={visibilityLabels}
        visibilityBadgeClasses={visibilityBadgeClasses}
      />
      <span class="text-xs text-slate-400 dark:text-slate-500">
        Created {#if data.ownerUsername}by <span class="font-medium text-slate-500 dark:text-slate-400">@{data.ownerUsername}</span> · {/if} {new Date(data.counter.createdAt).toLocaleDateString()}
        · Updated {new Date(displayUpdatedAt).toLocaleString()}
      </span>
    </div>
  </header>

  <!-- Counter — centered focal point -->
  <section
    class="relative flex-1 flex flex-col items-center justify-center py-6 select-none"
  >
    <div
      class="absolute bottom-0 h-2/3 left-1/2 w-screen -translate-x-1/2 pointer-events-none"
    >
      <Sparkline counterId={data.counter.id} />
    </div>

    <Fireworks trigger={fireworkTrigger} />
    <p class="text-8xl sm:text-9xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">
      <RollingNumber value={displayCount} />
    </p>

    <button
      type="button"
      onclick={handleIncrement}
      disabled={!data.canIncrement || isIncrementing || $rateLimit.isLimited}
      aria-disabled={!data.canIncrement || isIncrementing || $rateLimit.isLimited}
      aria-label={data.canIncrement ? "Increment counter" : "Increment unavailable"}
      class="mt-8 inline-flex items-center justify-center rounded-full w-16 h-16 text-2xl font-bold active:scale-95 transition shadow-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none dark:disabled:bg-slate-600"
    >
      {#if $rateLimit.isLimited}
        <span class="text-base">{$rateLimit.retryAfterSeconds}s</span>
      {:else}
        +1
      {/if}
    </button>

    {#if incrementUnavailableMessage}
      <p class="mt-3 text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
        {incrementUnavailableMessage}
      </p>
    {/if}

    {#if errorMessage}
      <p class="mt-2 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
    {/if}
  </section>

  <!-- History — subtle footer -->
  {#if data.history.length > 0}
    <footer class="border-t border-slate-200 dark:border-slate-700 pt-4 pb-2">
      <h2
        class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2"
      >
        Recent activity
      </h2>
      <ol class="flex flex-wrap gap-x-4 gap-y-1">
        {#each visibleHistory as entry, i (entry.id)}
          <HistoryEntry
            username={entry.username}
            newValue={entry.newValue}
            previousValue={entry.previousValue}
            changedAt={entry.changedAt}
            index={i}
          />
        {/each}
      </ol>
      {#if data.history.length > COLLAPSED_HISTORY_COUNT}
        <button
          type="button"
          onclick={() => (historyExpanded = !historyExpanded)}
          class="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:text-slate-300"
        >
          {historyExpanded
            ? "Show less"
            : `Show all ${data.history.length} entries`}
        </button>
      {/if}
    </footer>
  {/if}
</div>

<!-- Share Modal -->
<Modal bind:open={showShareModal} title="Share Counter">
  <div class="space-y-5">
    <div class="space-y-1">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Visibility</p>
      <div class="flex flex-wrap items-center gap-2">
        {#if visibilityMode === "public_readonly"}
          <span class="text-xs px-2 py-0.5 rounded-full {visibilityBadgeClasses.public}">
            {visibilityLabels.public}
          </span>
          <span class="text-xs px-2 py-0.5 rounded-full {visibilityBadgeClasses.public_readonly}">
            read-only
          </span>
        {:else}
          <span
            class="text-xs px-2 py-0.5 rounded-full {visibilityBadgeClasses[visibilityMode]}"
          >
            {visibilityLabels[visibilityMode]}
          </span>
        {/if}
        <p class="text-xs text-slate-500 dark:text-slate-400">{visibilityDescriptions[visibilityMode]}</p>
      </div>
    </div>

    <!-- Shareable link -->
    <div class="space-y-1">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Shareable link</p>
      <div class="flex items-center gap-2">
        <p
          class="flex-1 text-sm text-slate-500 bg-slate-50 rounded-md px-3 py-2 font-mono select-all truncate dark:text-slate-400 dark:bg-slate-700"
        >
          {shareUrl}
        </p>
        <button
          type="button"
          onclick={copyShareLink}
          class="shrink-0 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          {#if copySuccess}
            <ion-icon
              name="checkmark-outline"
              style="font-size: 16px;"
              class="text-green-600 dark:text-green-400"
            ></ion-icon>
            Copied
          {:else}
            <ion-icon name="copy-outline" style="font-size: 16px;"></ion-icon>
            Copy
          {/if}
        </button>
      </div>
      {#if visibilityMode === "private" && data.shareToken}
        <p class="text-xs text-amber-600 dark:text-amber-400">
          Anyone with this link can view and increment this private counter.
        </p>
      {/if}
    </div>

    <!-- Invite form -->
    <div class="space-y-2">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Invite member</p>
      <div class="flex gap-2 items-end">
        <div class="flex-1">
          <label
            class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
            for="invite-username">Username</label
          >
          <input
            id="invite-username"
            type="text"
            bind:value={inviteUsername}
            placeholder="username"
            class="w-full h-9 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
          />
        </div>
        <div>
          <label class="block text-xs text-slate-500 dark:text-slate-400 mb-1" for="invite-role"
            >Role</label
          >
          <select
            id="invite-role"
            bind:value={inviteRole}
            class="h-9 rounded-md border border-slate-300 px-3 text-sm bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400"
          >
            <option value="viewer">Viewer</option>
            <option value="incrementer">Incrementer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="button"
          onclick={handleInvite}
          disabled={isInviting || !inviteUsername.trim()}
          class="h-9 px-4 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          Invite
        </button>
      </div>

      {#if inviteError}
        <p class="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
      {/if}
      {#if inviteSuccess}
        <p class="text-sm text-green-600 dark:text-green-400">{inviteSuccess}</p>
      {/if}
    </div>

    <!-- Member list -->
    {#if data.members.length > 0}
      <div class="space-y-2">
        <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Members</p>
        <ul class="divide-y divide-slate-200 dark:divide-slate-700">
          {#each data.members as member (member.id)}
            <li class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                {#if member.image}
                  <img
                    src={member.image}
                    alt=""
                    class="w-8 h-8 rounded-full"
                  />
                {:else}
                  <div
                    class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                  >
                    {(member.username ?? "?")[0]}
                  </div>
                {/if}
                <div>
                  <p class="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {member.username ?? member.name ?? "Unknown"}
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {getRoleLabel(member.role)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onclick={() => handleRemoveMember(member.userId)}
                class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <p class="text-sm text-slate-500 dark:text-slate-400">
        No members yet. Invite someone above.
      </p>
    {/if}

    <div class="flex justify-end pt-2">
      <button
        type="button"
        onclick={() => (showShareModal = false)}
        class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
      >
        Done
      </button>
    </div>
  </div>
</Modal>

<!-- Edit Modal -->
<Modal bind:open={showEditModal} title="Edit Counter" maxWidth="max-w-md">
  <div class="space-y-4">
    <div class="space-y-2">
      <label
        class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        for="edit-title">Title</label
      >
      <input
        id="edit-title"
        type="text"
        bind:value={editTitle}
        class="w-full rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400 dark:placeholder:text-slate-500"
      />
    </div>

    <div class="space-y-2">
      <label
        class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        for="edit-description">Description</label
      >
      <textarea
        id="edit-description"
        rows="3"
        bind:value={editDescription}
        class="w-full rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400 dark:placeholder:text-slate-500"
      ></textarea>
    </div>

    <div class="space-y-2">
      <span class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        >Visibility</span
      >
      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="radio" value="public" bind:group={editVisibility} />
          Public
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="radio"
            value="public_readonly"
            bind:group={editVisibility}
          />
          Public (read-only)
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="radio" value="private" bind:group={editVisibility} />
          Private (shareable link)
        </label>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400">{visibilityDescriptions[editVisibility]}</p>
    </div>

    {#if editError}
      <p class="text-sm text-red-600 dark:text-red-400">{editError}</p>
    {/if}

    <div class="flex justify-end gap-3">
      <button
        type="button"
        onclick={() => (showEditModal = false)}
        class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleSaveEdit}
        disabled={isSaving}
        class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save"}
      </button>
    </div>
  </div>
</Modal>

<!-- Delete Confirmation -->
<Modal bind:open={showDeleteConfirm} title="Delete Counter?" maxWidth="max-w-sm" describedBy="delete-counter-description">
  <p id="delete-counter-description" class="text-slate-600 dark:text-slate-400">
    This action cannot be undone. The counter and its history will be
    permanently deleted.
  </p>
  <div class="flex justify-end gap-3">
    <button
      type="button"
      onclick={() => (showDeleteConfirm = false)}
      class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
    >
      Cancel
    </button>
    <button
      type="button"
      onclick={handleDelete}
      disabled={isDeleting}
      class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  </div>
</Modal>
