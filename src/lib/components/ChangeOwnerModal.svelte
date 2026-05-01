<script lang="ts">
  import Modal from "$lib/components/Modal.svelte";

  type UserResult = {
    id: string;
    name: string | null;
    username: string | null;
    email: string | null;
    image: string | null;
  };

  let {
    open = $bindable(),
    counterId,
    counterTitle,
    currentOwnerName,
    onsave,
  }: {
    open: boolean;
    counterId: string;
    counterTitle: string;
    currentOwnerName: string | null;
    onsave?: () => void;
  } = $props();

  let query = $state("");
  let results = $state<UserResult[]>([]);
  let selectedUser = $state<UserResult | null>(null);
  let removeOwner = $state(false);
  let loading = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let searchInput = $state<HTMLInputElement | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let hasSelection = $derived(selectedUser !== null || removeOwner);

  // Reset state when modal opens
  $effect(() => {
    if (open) {
      query = "";
      results = [];
      selectedUser = null;
      removeOwner = false;
      loading = false;
      saving = false;
      error = null;
      setTimeout(() => searchInput?.focus(), 50);
    }
  });

  // Debounced search
  $effect(() => {
    const q = query.trim();

    if (debounceTimer) clearTimeout(debounceTimer);

    if (!q) {
      results = [];
      loading = false;
      return;
    }

    loading = true;
    debounceTimer = setTimeout(() => {
      fetchUsers(q);
    }, 300);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  async function fetchUsers(q: string) {
    error = null;
    try {
      const response = await fetch(
        `/api/admin/users/search?q=${encodeURIComponent(q)}`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        error = body.error ?? "Failed to search users.";
        return;
      }
      const data: { users: UserResult[] } = await response.json();
      results = data.users;
    } catch {
      error = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  function selectUser(user: UserResult) {
    selectedUser = user;
    removeOwner = false;
  }

  function handleRemoveOwner() {
    removeOwner = true;
    selectedUser = null;
  }

  async function handleSave() {
    if (saving || !hasSelection) return;
    saving = true;
    error = null;

    try {
      const response = await fetch(
        `/api/admin/counters/${counterId}/owner`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerId: removeOwner ? null : selectedUser?.id,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        error = body.error ?? "Failed to change owner.";
        return;
      }

      onsave?.();
      open = false;
    } catch {
      error = "Network error. Please try again.";
    } finally {
      saving = false;
    }
  }
</script>

<Modal {open} title='Change Owner: "{counterTitle}"' maxWidth="max-w-md">
  <div class="space-y-4">
    <!-- Current owner -->
    <p class="text-sm text-slate-600 dark:text-slate-400">
      Current owner:
      <span class="font-medium text-slate-900 dark:text-slate-100">
        {currentOwnerName ?? "None"}
      </span>
    </p>

    <!-- Search input -->
    <div class="relative">
      <ion-icon
        name="search-outline"
        class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        style="font-size: 16px;"
      ></ion-icon>
      <input
        bind:this={searchInput}
        bind:value={query}
        type="text"
        placeholder="Search users..."
        class="w-full rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 pl-9 pr-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
    </div>

    <!-- Search results -->
    {#if loading}
      <div class="flex items-center justify-center py-4">
        <span class="text-sm text-slate-500 dark:text-slate-400">Searching…</span>
      </div>
    {:else if error}
      <div class="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
        <p class="text-sm text-red-700 dark:text-red-400">{error}</p>
      </div>
    {:else if results.length > 0}
      <ul class="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-600 divide-y divide-slate-200 dark:divide-slate-600">
        {#each results as user (user.id)}
          <li>
            <button
              type="button"
              onclick={() => selectUser(user)}
              class="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition
                {selectedUser?.id === user.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}"
            >
              <div class="flex items-center justify-between">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {user.name ?? "Unnamed"}
                    {#if user.username}
                      <span class="text-slate-500 dark:text-slate-400">@{user.username}</span>
                    {/if}
                  </p>
                  {#if user.email}
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                  {/if}
                </div>
                {#if selectedUser?.id === user.id}
                  <ion-icon
                    name="checkmark-circle"
                    class="text-blue-600 dark:text-blue-400 shrink-0 ml-2"
                    style="font-size: 18px;"
                  ></ion-icon>
                {/if}
              </div>
            </button>
          </li>
        {/each}
      </ul>
    {:else if query.trim()}
      <p class="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No users found.</p>
    {/if}

    <!-- Remove Owner button -->
    {#if currentOwnerName}
      <button
        type="button"
        onclick={handleRemoveOwner}
        class="w-full text-left px-3 py-2 rounded-md border text-sm transition
          {removeOwner
            ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}"
      >
        <span class="flex items-center gap-2">
          <ion-icon name="person-remove-outline" style="font-size: 16px;"></ion-icon>
          Remove Owner
          {#if removeOwner}
            <ion-icon name="checkmark-circle" class="ml-auto text-red-600 dark:text-red-400" style="font-size: 16px;"></ion-icon>
          {/if}
        </span>
      </button>
    {/if}

    <!-- Footer -->
    <div class="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onclick={() => (open = false)}
        class="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleSave}
        disabled={!hasSelection || saving}
        class="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  </div>
</Modal>
