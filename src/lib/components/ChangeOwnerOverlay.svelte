<script lang="ts">
  import FullscreenOverlay from "$lib/components/FullscreenOverlay.svelte";

  type UserResult = {
    id: string;
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
  let searchError = $state<string | null>(null);
  let saveError = $state<string | null>(null);
  let searchInput = $state<HTMLInputElement | null>(null);

  let hasSelection = $derived(selectedUser !== null || removeOwner);

  $effect(() => {
    if (!open) return;
    query = "";
    results = [];
    selectedUser = null;
    removeOwner = false;
    loading = false;
    saving = false;
    searchError = null;
    saveError = null;
    // Runs after FullscreenOverlay's own focus handling
    const timer = setTimeout(() => searchInput?.focus(), 0);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const q = query.trim();

    if (!q) {
      results = [];
      loading = false;
      return;
    }

    loading = true;
    const timer = setTimeout(() => fetchUsers(q), 300);
    return () => clearTimeout(timer);
  });

  async function fetchUsers(q: string) {
    searchError = null;
    try {
      const response = await fetch(
        `/api/admin/users/search?q=${encodeURIComponent(q)}`,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        searchError = body.error ?? "Failed to search users.";
        return;
      }
      const data: { users: UserResult[] } = await response.json();
      results = data.users;
    } catch {
      searchError = "Network error. Please try again.";
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
    saveError = null;

    try {
      const response = await fetch(`/api/admin/counters/${counterId}/owner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: removeOwner ? null : selectedUser?.id,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        saveError = body.error ?? "Failed to change owner.";
        return;
      }

      onsave?.();
      open = false;
    } catch {
      saveError = "Network error. Please try again.";
    } finally {
      saving = false;
    }
  }
</script>

<FullscreenOverlay bind:open title="Change Owner">
  <section
    class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
  >
    <p
      class="truncate text-base font-semibold text-slate-900 dark:text-slate-100"
    >
      {counterTitle}
    </p>
    <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
      Current owner:
      <span class="font-medium text-slate-900 dark:text-slate-100">
        {currentOwnerName ?? "None"}
      </span>
    </p>
  </section>

  <section class="space-y-4">
    <div class="relative">
      <ion-icon
        name="search-outline"
        aria-hidden="true"
        class="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        style="font-size: 24px;"
      ></ion-icon>
      <input
        bind:this={searchInput}
        bind:value={query}
        type="text"
        placeholder="Search users…"
        aria-label="Search users"
        class="w-full border-0 border-b-2 border-slate-300 bg-transparent py-2 pl-9 pr-9 text-xl font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-0 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 sm:text-2xl"
      />
      {#if loading}
        <span
          role="status"
          aria-label="Searching"
          class="absolute right-0 top-1/2 flex -translate-y-1/2 text-slate-400 dark:text-slate-500"
        >
          <ion-icon
            name="sync-outline"
            aria-hidden="true"
            class="animate-spin"
            style="font-size: 20px;"
          ></ion-icon>
        </span>
      {/if}
    </div>

    {#if searchError}
      <p role="alert" class="text-sm text-red-600 dark:text-red-400">
        {searchError}
      </p>
    {:else if results.length > 0}
      <ul class="space-y-2">
        {#each results as user (user.id)}
          {@const selected = selectedUser?.id === user.id}
          <li>
            <button
              type="button"
              onclick={() => selectUser(user)}
              aria-pressed={selected}
              class="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors {selected
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 dark:border-blue-400 dark:bg-blue-900/20 dark:ring-blue-400'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/50'}"
            >
              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  {user.username ? `@${user.username}` : "Unknown"}
                </p>
                {#if user.email}
                  <p class="truncate text-sm text-slate-500 dark:text-slate-400">
                    {user.email}
                  </p>
                {/if}
              </div>
              {#if selected}
                <ion-icon
                  name="checkmark-circle"
                  aria-hidden="true"
                  class="shrink-0 text-blue-600 dark:text-blue-400"
                  style="font-size: 22px;"
                ></ion-icon>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {:else if query.trim() && !loading}
      <p class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
        No users found.
      </p>
    {/if}
  </section>

  {#if currentOwnerName}
    <section>
      <button
        type="button"
        onclick={handleRemoveOwner}
        aria-pressed={removeOwner}
        class="flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium transition-colors {removeOwner
          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50'}"
      >
        <ion-icon
          name="person-remove-outline"
          aria-hidden="true"
          style="font-size: 18px;"
        ></ion-icon>
        Remove owner
        {#if removeOwner}
          <ion-icon
            name="checkmark-circle"
            aria-hidden="true"
            class="ml-auto text-red-600 dark:text-red-400"
            style="font-size: 20px;"
          ></ion-icon>
        {/if}
      </button>
    </section>
  {/if}

  {#snippet footer()}
    <div class="space-y-2">
      {#if saveError}
        <p role="alert" class="text-sm text-red-600 dark:text-red-400">
          {saveError}
        </p>
      {/if}
      <div class="flex items-center justify-end gap-3">
        <button
          type="button"
          onclick={() => (open = false)}
          class="text-sm text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={handleSave}
          disabled={!hasSelection || saving}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-slate-900"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  {/snippet}
</FullscreenOverlay>
