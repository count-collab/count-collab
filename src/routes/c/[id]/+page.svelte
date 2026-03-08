<script lang="ts">
  import { browser } from "$app/environment";
  import { goto, invalidate } from "$app/navigation";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { onCounterUpdated } from "$lib/stores/counters";
  import { rateLimit } from "$lib/stores/ratelimit";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let optimisticCount = $state<number | null>(null);
  let optimisticUpdatedAt = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  let isIncrementing = $state(false);

  // Edit modal state
  let showEditModal = $state(false);
  let editTitle = $state("");
  let editDescription = $state("");
  let editVisibility = $state<"public" | "private">("public");
  let editError = $state<string | null>(null);
  let isSaving = $state(false);

  // Delete confirmation state
  let showDeleteConfirm = $state(false);
  let isDeleting = $state(false);

  // Share modal state
  let showShareModal = $state(false);
  let copySuccess = $state(false);

  const shareUrl = $derived(
    browser
      ? `${window.location.origin}/c/${data.counter.id}`
      : `/c/${data.counter.id}`,
  );

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
  let inviteRole = $state<"viewer" | "editor" | "admin">("viewer");
  let inviteError = $state<string | null>(null);
  let inviteSuccess = $state<string | null>(null);
  let isInviting = $state(false);

  const displayCount = $derived(optimisticCount ?? data.counter.count);
  const displayUpdatedAt = $derived(
    optimisticUpdatedAt ?? data.counter.updatedAt,
  );

  async function handleIncrement() {
    if (isIncrementing) return;

    if ($rateLimit.isLimited) {
      errorMessage = `Please wait ${$rateLimit.retryAfterSeconds}s before incrementing again.`;
      return;
    }

    isIncrementing = true;
    errorMessage = null;

    try {
      const response = await fetch(`/c/${data.counter.id}`, { method: "POST" });

      if (!response.ok) {
        const body = await response.json();

        if (response.status === 429) {
          const retryAfter = body.retryAfterSeconds ?? 5;
          rateLimit.setLimit(`/c/${data.counter.id}`, retryAfter);
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
      rateLimit.setLimit(`/c/${data.counter.id}`, result.cooldownSeconds);
      invalidate(`counter:${data.counter.id}`);
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
      const response = await fetch(`/c/${data.counter.id}`, {
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
      const response = await fetch(`/c/${data.counter.id}`, {
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

      inviteSuccess = `Invited ${inviteUsername} as ${inviteRole}`;
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
/>

<div class="flex flex-col min-h-[calc(100vh-8rem)]">
  <!-- Header bar -->
  <header class="flex items-center justify-between pb-4">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold text-slate-900 truncate">
          {data.counter.title}
        </h1>
        <span
          class="shrink-0 text-xs px-2 py-0.5 rounded-full {data.counter
            .isPublic
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-600'}"
        >
          {data.counter.isPublic ? "Public" : "Private"}
        </span>
        {#if data.isOwner}
          <span
            class="shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"
            >Owner</span
          >
        {/if}
      </div>
      {#if data.counter.description}
        <p class="text-sm text-slate-500 mt-0.5 truncate">
          {data.counter.description}
        </p>
      {/if}
    </div>

    <div class="flex gap-2 shrink-0 ml-4">
      {#if data.canManage}
        <button
          type="button"
          onclick={() => (showShareModal = true)}
          class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share
        </button>
      {/if}
      {#if data.canEdit}
        <button
          type="button"
          onclick={() => {
            editTitle = data.counter.title;
            editDescription = data.counter.description ?? "";
            editVisibility = data.counter.isPublic ? "public" : "private";
            showEditModal = true;
          }}
          class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition"
        >
          Edit
        </button>
      {/if}
      {#if data.canDelete}
        <button
          type="button"
          onclick={() => (showDeleteConfirm = true)}
          class="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
        >
          Delete
        </button>
      {/if}
    </div>
  </header>

  <!-- Counter — centered focal point -->
  <section
    class="flex-1 flex flex-col items-center justify-center py-6 select-none"
  >
    <p class="text-8xl sm:text-9xl font-extrabold tabular-nums text-blue-600">
      {displayCount}
    </p>

    <button
      type="button"
      onclick={handleIncrement}
      class="mt-8 inline-flex items-center justify-center rounded-full w-16 h-16 text-2xl font-bold active:scale-95 transition shadow-lg {$rateLimit.isLimited
        ? 'bg-slate-400 text-white cursor-not-allowed'
        : 'bg-blue-600 text-white hover:bg-blue-700'}"
    >
      {#if $rateLimit.isLimited}
        <span class="text-base">{$rateLimit.retryAfterSeconds}s</span>
      {:else}
        +1
      {/if}
    </button>

    <p class="mt-4 text-xs text-slate-400">
      Last updated {new Date(displayUpdatedAt).toLocaleString()}
    </p>

    {#if errorMessage}
      <p class="mt-2 text-sm text-red-600">{errorMessage}</p>
    {/if}
  </section>

  <!-- History — subtle footer -->
  {#if data.history.length > 0}
    <footer class="border-t border-slate-200 pt-4 pb-2">
      <h2
        class="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2"
      >
        Recent activity
      </h2>
      <ol class="flex flex-wrap gap-x-4 gap-y-1">
        {#each data.history as entry (entry.id)}
          <li class="text-xs text-slate-400">
            {entry.previousValue} &rarr; {entry.newValue}
            <span class="text-slate-300">
              {new Date(entry.changedAt).toLocaleTimeString()}
            </span>
          </li>
        {/each}
      </ol>
    </footer>
  {/if}
</div>

<!-- Share Modal -->
{#if showShareModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    role="dialog"
    aria-label="Share counter"
  >
    <div
      class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-5"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-slate-900">Share Counter</h2>
        <button
          type="button"
          onclick={() => (showShareModal = false)}
          class="text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Shareable link -->
      <div class="space-y-1">
        <p class="text-sm font-medium text-slate-700">Shareable link</p>
        <div class="flex items-center gap-2">
          <p
            class="flex-1 text-sm text-slate-500 bg-slate-50 rounded-md px-3 py-2 font-mono select-all truncate"
          >
            {shareUrl}
          </p>
          <button
            type="button"
            onclick={copyShareLink}
            class="shrink-0 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5"
          >
            {#if copySuccess}
              <svg
                class="w-4 h-4 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied
            {:else}
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            {/if}
          </button>
        </div>
      </div>

      <!-- Invite form -->
      <div class="space-y-2">
        <p class="text-sm font-medium text-slate-700">Invite member</p>
        <div class="flex gap-2 items-end">
          <div class="flex-1">
            <label
              class="block text-xs text-slate-500 mb-1"
              for="invite-username">Username</label
            >
            <input
              id="invite-username"
              type="text"
              bind:value={inviteUsername}
              placeholder="username"
              class="w-full h-9 rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1" for="invite-role"
              >Role</label
            >
            <select
              id="invite-role"
              bind:value={inviteRole}
              class="h-9 rounded-md border border-slate-300 px-3 text-sm bg-white focus:border-blue-500 focus:outline-none"
            >
              <option value="viewer">Viewer</option>
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
          <p class="text-sm text-red-600">{inviteError}</p>
        {/if}
        {#if inviteSuccess}
          <p class="text-sm text-green-600">{inviteSuccess}</p>
        {/if}
      </div>

      <!-- Member list -->
      {#if data.members.length > 0}
        <div class="space-y-2">
          <p class="text-sm font-medium text-slate-700">Members</p>
          <ul class="divide-y divide-slate-200">
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
                      class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600"
                    >
                      {(member.username ?? "?")[0]}
                    </div>
                  {/if}
                  <div>
                    <p class="text-sm font-medium text-slate-900">
                      {member.username ?? member.name ?? "Unknown"}
                    </p>
                    <p class="text-xs text-slate-500 capitalize">
                      {member.role}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onclick={() => handleRemoveMember(member.userId)}
                  class="text-sm text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {:else}
        <p class="text-sm text-slate-500">
          No members yet. Invite someone above.
        </p>
      {/if}

      <div class="flex justify-end pt-2">
        <button
          type="button"
          onclick={() => (showShareModal = false)}
          class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    role="dialog"
  >
    <div
      class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4"
    >
      <h2 class="text-xl font-bold text-slate-900">Edit Counter</h2>

      <div class="space-y-2">
        <label
          class="block text-sm font-semibold text-slate-700"
          for="edit-title">Title</label
        >
        <input
          id="edit-title"
          type="text"
          bind:value={editTitle}
          class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div class="space-y-2">
        <label
          class="block text-sm font-semibold text-slate-700"
          for="edit-description">Description</label
        >
        <textarea
          id="edit-description"
          rows="3"
          bind:value={editDescription}
          class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        ></textarea>
      </div>

      <div class="space-y-2">
        <span class="block text-sm font-semibold text-slate-700"
          >Visibility</span
        >
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" value="public" bind:group={editVisibility} />
            Public
          </label>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" value="private" bind:group={editVisibility} />
            Private
          </label>
        </div>
      </div>

      {#if editError}
        <p class="text-sm text-red-600">{editError}</p>
      {/if}

      <div class="flex justify-end gap-3">
        <button
          type="button"
          onclick={() => (showEditModal = false)}
          class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
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
  </div>
{/if}

<!-- Delete Confirmation -->
{#if showDeleteConfirm}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    role="dialog"
  >
    <div
      class="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6 space-y-4"
    >
      <h2 class="text-xl font-bold text-slate-900">Delete Counter?</h2>
      <p class="text-slate-600">
        This action cannot be undone. The counter and its history will be
        permanently deleted.
      </p>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          onclick={() => (showDeleteConfirm = false)}
          class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
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
    </div>
  </div>
{/if}
