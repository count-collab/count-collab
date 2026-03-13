<script lang="ts">
  import { browser } from "$app/environment";
  import { goto, invalidate } from "$app/navigation";
  import CounterCard from "$lib/components/CounterCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import { onCounterUpdated } from "$lib/stores/counters";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  // Edit modal state
  let showEditModal = $state(false);
  let editTitle = $state("");
  let editDescription = $state("");
  let editVisibility = $state<"public" | "private">("private");
  let editError = $state<string | null>(null);
  let isSaving = $state(false);

  // Delete confirmation state
  let showDeleteConfirm = $state(false);
  let isDeleting = $state(false);

  // Set main state
  let isSettingMain = $state(false);

  // Share modal state
  let showShareModal = $state(false);
  let copySuccess = $state(false);

  // Member invitation state
  let inviteUsername = $state("");
  let inviteRole = $state<"viewer" | "editor" | "admin">("viewer");
  let inviteError = $state<string | null>(null);
  let inviteSuccess = $state<string | null>(null);
  let isInviting = $state(false);

  // Add counter state
  let showAddCounter = $state(false);
  let addCounterSearch = $state("");
  let addCounterResults = $state<{ id: string; title: string; count: number }[]>([]);
  let isSearching = $state(false);
  let addError = $state<string | null>(null);

  // Actions dropdown state
  let showActionsMenu = $state(false);

  let errorMessage = $state<string | null>(null);

  const shareUrl = $derived(
    browser
      ? `${window.location.origin}/dashboards/${data.dashboard.id}`
      : `/dashboards/${data.dashboard.id}`,
  );

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copySuccess = true;
      setTimeout(() => (copySuccess = false), 2000);
    } catch {
      // fallback
    }
  }

  async function handleSetMain() {
    if (isSettingMain) return;
    isSettingMain = true;

    try {
      const response = await fetch(
        `/dashboards/${data.dashboard.id}/main`,
        { method: "POST" },
      );

      if (!response.ok) {
        const body = await response.json();
        errorMessage = body.error ?? "Failed to set as main dashboard.";
        return;
      }

      // Reload page to reflect changes
      window.location.reload();
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      isSettingMain = false;
    }
  }

  async function handleSaveEdit() {
    if (isSaving) return;
    isSaving = true;
    editError = null;

    try {
      const response = await fetch(`/dashboards/${data.dashboard.id}`, {
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
        editError = body.error ?? "Failed to update dashboard.";
        return;
      }

      showEditModal = false;
      window.location.reload();
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
      const response = await fetch(`/dashboards/${data.dashboard.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json();
        errorMessage = body.error ?? "Failed to delete dashboard.";
        showDeleteConfirm = false;
        return;
      }

      await goto("/dashboards");
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      isDeleting = false;
      showDeleteConfirm = false;
    }
  }

  let lastSearchedQuery = $state("");

  async function handleSearchCounters(query?: string) {
    const searchTerm = (query ?? addCounterSearch).trim();
    if (!searchTerm) {
      addCounterResults = [];
      lastSearchedQuery = "";
      return;
    }
    if (searchTerm === lastSearchedQuery) return;
    isSearching = true;
    try {
      const response = await fetch(
        `/api/counters/search?q=${encodeURIComponent(searchTerm)}`,
      );
      if (response.ok) {
        const body = await response.json();
        addCounterResults = body.counters ?? [];
        lastSearchedQuery = searchTerm;
      }
    } catch {
      // silently fail
    } finally {
      isSearching = false;
    }
  }

  $effect(() => {
    if (!browser || !showAddCounter) return;

    const query = addCounterSearch.trim();

    if (!query) {
      addCounterResults = [];
      lastSearchedQuery = "";
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearchCounters(query);
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  })

  async function handleAddCounter(counterId: string) {
    addError = null;
    try {
      const response = await fetch(
        `/dashboards/${data.dashboard.id}/counters`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ counterId }),
        },
      );

      if (!response.ok) {
        const body = await response.json();
        addError = body.error ?? "Failed to add counter.";
        return;
      }

      window.location.reload();
    } catch {
      addError = "Network error. Please try again.";
    }
  }

  async function handleRemoveCounter(counterId: string) {
    try {
      const response = await fetch(
        `/dashboards/${data.dashboard.id}/counters`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ counterId }),
        },
      );

      if (response.ok) {
        window.location.reload();
      }
    } catch {
      // silently fail
    }
  }

  async function handleInvite() {
    if (isInviting || !inviteUsername.trim()) return;
    isInviting = true;
    inviteError = null;
    inviteSuccess = null;

    try {
      const response = await fetch(
        `/dashboards/${data.dashboard.id}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: inviteUsername, role: inviteRole }),
        },
      );

      if (!response.ok) {
        const body = await response.json();
        inviteError = body.error ?? "Failed to invite user.";
        return;
      }

      inviteSuccess = `Invited ${inviteUsername} as ${inviteRole}`;
      inviteUsername = "";
      window.location.reload();
    } catch {
      inviteError = "Network error. Please try again.";
    } finally {
      isInviting = false;
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const response = await fetch(
        `/dashboards/${data.dashboard.id}/members/${userId}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        window.location.reload();
      }
    } catch {
      // silently fail
    }
  }

  $effect(() => {
    if (!browser) return;

    const unsubscribe = onCounterUpdated(() => {
      invalidate(`dashboards:${data.dashboard.id}`);
    });

    return unsubscribe;
  });
</script>

<MetaTags
  title="{data.dashboard.title} | Count Collab"
  description={data.dashboard.description || `Dashboard: ${data.dashboard.title}`}
  path="/dashboards/{data.dashboard.id}"
/>

<div class="space-y-6">
  <!-- Header -->
  <header>
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-slate-900 break-words">
            {data.dashboard.title}
          </h1>
          {#if data.dashboard.isMain}
            <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
              Main
            </span>
          {/if}
        </div>
        {#if data.dashboard.description}
          <p class="text-sm text-slate-500 mt-0.5 break-words">
            {data.dashboard.description}
          </p>
        {/if}
      </div>

      <!-- Desktop action buttons -->
      <div class="hidden sm:flex gap-2 shrink-0 ml-4">
        {#if data.isOwner && !data.dashboard.isMain}
          <button
            type="button"
            onclick={handleSetMain}
            disabled={isSettingMain}
            class="px-3 py-1.5 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition inline-flex items-center gap-1.5"
          >
            {isSettingMain ? "Setting..." : "Set as Main"}
          </button>
        {/if}
        {#if data.canManage}
          <button
            type="button"
            onclick={() => (showShareModal = true)}
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5"
          >
            <ion-icon name="share-social-outline" style="font-size: 16px;"></ion-icon>
            Share
          </button>
        {/if}
        {#if data.canEdit}
          <button
            type="button"
            onclick={() => {
              editTitle = data.dashboard.title;
              editDescription = data.dashboard.description ?? "";
              editVisibility = data.dashboard.isPublic ? "public" : "private";
              showEditModal = true;
            }}
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5"
          >
            <ion-icon name="create-outline" style="font-size: 16px;"></ion-icon>
            Edit
          </button>
        {/if}
        {#if data.canDelete}
          <button
            type="button"
            onclick={() => (showDeleteConfirm = true)}
            class="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition inline-flex items-center gap-1.5"
          >
            <ion-icon name="trash-outline" style="font-size: 16px;"></ion-icon>
            Delete
          </button>
        {/if}
      </div>

      <!-- Mobile actions dropdown -->
      {#if data.canManage || data.canEdit || data.canDelete || (data.isOwner && !data.dashboard.isMain)}
        <div class="relative sm:hidden shrink-0">
          <button
            type="button"
            onclick={() => (showActionsMenu = !showActionsMenu)}
            class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            aria-label="Dashboard actions"
          >
            <ion-icon name="ellipsis-vertical" style="font-size: 20px;"></ion-icon>
          </button>
          {#if showActionsMenu}
            <button
              type="button"
              class="fixed inset-0 z-40"
              aria-label="Close menu"
              onclick={() => (showActionsMenu = false)}
            ></button>
            <div class="absolute right-0 top-full mt-1 z-50 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
              {#if data.isOwner && !data.dashboard.isMain}
                <button
                  type="button"
                  onclick={() => { showActionsMenu = false; handleSetMain(); }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
                >
                  Set as Main
                </button>
              {/if}
              {#if data.canManage}
                <button
                  type="button"
                  onclick={() => { showActionsMenu = false; showShareModal = true; }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <ion-icon name="share-social-outline" style="font-size: 16px;"></ion-icon>
                  Share
                </button>
              {/if}
              {#if data.canEdit}
                <button
                  type="button"
                  onclick={() => {
                    showActionsMenu = false;
                    editTitle = data.dashboard.title;
                    editDescription = data.dashboard.description ?? "";
                    editVisibility = data.dashboard.isPublic ? "public" : "private";
                    showEditModal = true;
                  }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <ion-icon name="create-outline" style="font-size: 16px;"></ion-icon>
                  Edit
                </button>
              {/if}
              {#if data.canDelete}
                <button
                  type="button"
                  onclick={() => { showActionsMenu = false; showDeleteConfirm = true; }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <ion-icon name="trash-outline" style="font-size: 16px;"></ion-icon>
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
      <span
        class="text-xs px-2 py-0.5 rounded-full {data.dashboard.isPublic
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-100 text-slate-600'}"
      >
        {data.dashboard.isPublic ? "Public" : "Private"}
      </span>
      {#if data.isOwner}
        <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Owner</span>
      {/if}
      <span class="text-xs text-slate-400">
        {data.totalCounters} counter{data.totalCounters === 1 ? "" : "s"}
      </span>
    </div>

    {#if errorMessage}
      <p class="mt-2 text-sm text-red-600">{errorMessage}</p>
    {/if}
  </header>

  <!-- Add counter section -->
  {#if data.canEdit}
    <section>
      <button
        type="button"
        onclick={() => {
          showAddCounter = !showAddCounter;
          if (!showAddCounter) {
            addCounterSearch = "";
            addCounterResults = [];
            lastSearchedQuery = "";
            addError = null;
          }
        }}
        class="px-4 py-2 text-sm border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 transition text-slate-600"
      >
        {showAddCounter ? "Cancel" : "+ Add Counter"}
      </button>

      {#if showAddCounter}
        <div class="mt-3 bg-white rounded-lg shadow p-4 space-y-3">
          <div class="relative">
            <input
              type="text"
              bind:value={addCounterSearch}
              placeholder="Search counters by title..."
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {#if isSearching}
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching…</span>
            {/if}
          </div>
          {#if addError}
            <p class="text-sm text-red-600">{addError}</p>
          {/if}
          {#if addCounterResults.length > 0}
            <ul class="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {#each addCounterResults as counter (counter.id)}
                <li class="flex items-center justify-between py-2">
                  <div class="min-w-0 flex-1">
                    <span class="text-sm font-medium text-slate-900 truncate">{counter.title}</span>
                    <span class="text-xs text-slate-400 ml-2">({counter.count})</span>
                  </div>
                  <button
                    type="button"
                    onclick={() => handleAddCounter(counter.id)}
                    class="shrink-0 ml-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Add
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </section>
  {/if}

  <!-- Counter grid -->
  {#if data.counters.length === 0}
    <div class="text-center py-12">
      <p class="text-slate-500">No counters on this dashboard yet.</p>
      {#if data.canEdit}
        <p class="text-sm text-slate-400 mt-1">Use the "Add Counter" button above to get started.</p>
      {/if}
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {#each data.counters as counter (counter.id)}
        <div class="relative group">
          <CounterCard {counter} showBadges />
          {#if data.canEdit}
            <button
              type="button"
              onclick={() => handleRemoveCounter(counter.id)}
              class="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              aria-label="Remove counter from dashboard"
            >
              &times;
            </button>
          {/if}
        </div>
      {/each}
    </div>
    <Pagination
      page={data.counterPage}
      totalPages={data.counterTotalPages}
      baseUrl="/dashboards/{data.dashboard.id}"
    />
  {/if}

  <!-- Members section -->
  {#if data.canManage && data.members.length > 0}
    <section class="border-t border-slate-200 pt-6">
      <h2 class="text-lg font-bold text-slate-900 mb-3">Members</h2>
      <ul class="divide-y divide-slate-100">
        {#each data.members as member (member.id)}
          <li class="flex items-center justify-between py-2">
            <div class="flex items-center gap-2">
              {#if member.image}
                <img src={member.image} alt="" class="w-6 h-6 rounded-full" />
              {/if}
              <span class="text-sm font-medium text-slate-700">
                {member.username ?? member.name ?? "Unknown"}
              </span>
              <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {member.role}
              </span>
            </div>
            <button
              type="button"
              onclick={() => handleRemoveMember(member.userId)}
              class="text-xs text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<!-- Edit Modal -->
{#if showEditModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Edit dashboard">
    <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-slate-900">Edit Dashboard</h2>
        <button type="button" onclick={() => (showEditModal = false)} class="text-slate-400 hover:text-slate-600" aria-label="Close">
          <ion-icon name="close-outline" style="font-size: 20px;"></ion-icon>
        </button>
      </div>
      <div>
        <label for="edit-title" class="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input
          id="edit-title"
          type="text"
          bind:value={editTitle}
          maxlength={200}
          class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label for="edit-description" class="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          id="edit-description"
          bind:value={editDescription}
          maxlength={1000}
          rows={3}
          class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        ></textarea>
      </div>
      <div>
        <label for="edit-visibility" class="block text-sm font-medium text-slate-700 mb-1">Visibility</label>
        <select
          id="edit-visibility"
          bind:value={editVisibility}
          class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </div>
      {#if editError}
        <p class="text-sm text-red-600">{editError}</p>
      {/if}
      <div class="flex justify-end gap-2">
        <button type="button" onclick={() => (showEditModal = false)} class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition">
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
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Delete dashboard">
    <div class="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6 space-y-4">
      <h2 class="text-xl font-bold text-slate-900">Delete Dashboard</h2>
      <p class="text-sm text-slate-600">
        Are you sure you want to delete <strong>{data.dashboard.title}</strong>? This will remove all counter associations but won't delete the counters themselves.
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" onclick={() => (showDeleteConfirm = false)} class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition">
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

<!-- Share Modal -->
{#if showShareModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Share dashboard">
    <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-slate-900">Share Dashboard</h2>
        <button type="button" onclick={() => (showShareModal = false)} class="text-slate-400 hover:text-slate-600" aria-label="Close">
          <ion-icon name="close-outline" style="font-size: 20px;"></ion-icon>
        </button>
      </div>

      <!-- Shareable link -->
      <div class="space-y-1">
        <p class="text-sm font-medium text-slate-700">Shareable link</p>
        <div class="flex items-center gap-2">
          <p class="flex-1 text-sm text-slate-500 bg-slate-50 rounded-md px-3 py-2 font-mono select-all truncate">
            {shareUrl}
          </p>
          <button
            type="button"
            onclick={copyShareLink}
            class="shrink-0 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5"
          >
            {#if copySuccess}
              <ion-icon name="checkmark-outline" style="font-size: 16px;" class="text-green-600"></ion-icon>
              Copied
            {:else}
              <ion-icon name="copy-outline" style="font-size: 16px;"></ion-icon>
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
            <label class="block text-xs text-slate-500 mb-1" for="invite-dashboard-username">Username</label>
            <input
              id="invite-dashboard-username"
              type="text"
              bind:value={inviteUsername}
              placeholder="username"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1" for="invite-dashboard-role">Role</label>
            <select
              id="invite-dashboard-role"
              bind:value={inviteRole}
              class="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50"
          >
            {isInviting ? "..." : "Invite"}
          </button>
        </div>
        {#if inviteError}
          <p class="text-sm text-red-600">{inviteError}</p>
        {/if}
        {#if inviteSuccess}
          <p class="text-sm text-green-600">{inviteSuccess}</p>
        {/if}
      </div>
    </div>
  </div>
{/if}
