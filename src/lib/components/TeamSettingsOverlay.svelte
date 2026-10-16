<script lang="ts">
  import { tick } from "svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import FullscreenOverlay from "$lib/components/FullscreenOverlay.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import { slugify } from "$lib/counter";

  let {
    open = $bindable(),
    team,
    canDelete = false,
    counterCount = 0,
    dashboardCount = 0,
    onclose,
  }: {
    open: boolean;
    team: { id: string; name: string; description: string | null };
    canDelete?: boolean;
    counterCount?: number;
    dashboardCount?: number;
    onclose?: () => void;
  } = $props();

  let name = $state("");
  let description = $state("");
  let isSaving = $state(false);
  let saveError = $state("");
  let nameInput = $state<HTMLInputElement | null>(null);

  // Initialize local state from team prop when overlay opens
  $effect(() => {
    if (open) {
      name = team.name;
      description = team.description ?? "";
      isSaving = false;
      saveError = "";
      tick().then(() => nameInput?.focus());
    }
  });

  function close() {
    open = false;
    onclose?.();
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (isSaving || !trimmedName) return;
    isSaving = true;
    saveError = "";

    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const fieldError = Object.values(
          (body.errors ?? {}) as Record<string, string[] | undefined>,
        ).flat()[0];
        saveError =
          body.error ??
          body.message ??
          fieldError ??
          "Failed to save team settings.";
        return;
      }

      const renamed = slugify(trimmedName) !== slugify(team.name);
      close();
      if (renamed) {
        await goto(`/t/${team.id}/${slugify(trimmedName)}`, {
          replaceState: true,
          noScroll: true,
          keepFocus: true,
          invalidateAll: true,
        });
      } else {
        await invalidateAll();
      }
    } catch {
      saveError = "Network error. Please try again.";
    } finally {
      isSaving = false;
    }
  }

  // ── Delete ──
  let showDeleteModal = $state(false);
  let deleteConfirmName = $state("");
  let deleteError = $state("");
  let isDeleting = $state(false);
  let deleteButton = $state<HTMLButtonElement | null>(null);
  let deleteInput = $state<HTMLInputElement | null>(null);

  const canConfirmDelete = $derived(deleteConfirmName === team.name);

  async function openDeleteModal() {
    deleteConfirmName = "";
    deleteError = "";
    showDeleteModal = true;
    await tick();
    deleteInput?.focus();
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deleteButton?.focus();
  }

  async function handleDelete(event: SubmitEvent) {
    event.preventDefault();
    if (!canConfirmDelete || isDeleting) return;
    isDeleting = true;
    deleteError = "";

    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: deleteConfirmName }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        deleteError =
          body.error ?? body.message ?? "Failed to delete team.";
        return;
      }

      showDeleteModal = false;
      open = false;
      await goto("/my/teams");
    } catch {
      deleteError = "Network error. Please try again.";
    } finally {
      isDeleting = false;
    }
  }
</script>

<FullscreenOverlay bind:open title="Team Settings" {onclose}>
        <!-- Section 1: Name & Description -->
        <section class="space-y-4">
          <div class="space-y-4">
            <input
              type="text"
              bind:this={nameInput}
              bind:value={name}
              aria-label="Team name"
              placeholder="Give it a name..."
              required
              maxlength={50}
              autocomplete="off"
              class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-2xl font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0"
            />
            <input
              type="text"
              bind:value={description}
              aria-label="Team description"
              maxlength={500}
              placeholder="Add a description (optional)"
              autocomplete="off"
              class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-1 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0"
            />
          </div>
        </section>

        {#if canDelete}
          <!-- Section 2: Danger zone -->
          <section
            class="space-y-4 rounded-xl border-2 border-red-200 dark:border-red-800 p-6"
          >
            <h3 class="text-lg font-semibold text-red-700 dark:text-red-400">
              Danger zone
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Permanently delete this team together with all its counters and
              dashboards. This action cannot be undone.
            </p>
            <button
              type="button"
              bind:this={deleteButton}
              onclick={openDeleteModal}
              class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Delete team
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
          onclick={close}
          class="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={handleSave}
          disabled={isSaving || !name.trim()}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isSaving}
            Saving…
          {:else}
            Save changes
          {/if}
        </button>
      </div>
    </div>
  {/snippet}
</FullscreenOverlay>

<Modal
  bind:open={showDeleteModal}
  title="Delete team?"
  describedBy="delete-team-description"
  onclose={() => deleteButton?.focus()}
>
  <form onsubmit={handleDelete} class="space-y-4">
    <div id="delete-team-description" class="space-y-2">
      <p class="text-sm text-slate-700 dark:text-slate-300">
        All {counterCount}
        {counterCount === 1 ? "counter" : "counters"} and {dashboardCount}
        {dashboardCount === 1 ? "dashboard" : "dashboards"} in this team will be
        permanently deleted.
      </p>
      <p class="text-sm font-semibold text-red-600 dark:text-red-400">
        This action cannot be undone.
      </p>
    </div>
    <div>
      <label
        for="delete-team-confirm"
        class="block text-sm text-slate-700 dark:text-slate-300 mb-1"
      >
        Type <span class="font-semibold">{team.name}</span> to confirm
      </label>
      <input
        id="delete-team-confirm"
        type="text"
        bind:this={deleteInput}
        bind:value={deleteConfirmName}
        placeholder={team.name}
        autocomplete="off"
        class="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-red-500 dark:focus:border-red-400 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
    <div aria-live="polite">
      {#if deleteError}
        <p role="alert" class="text-sm text-red-600 dark:text-red-400">
          {deleteError}
        </p>
      {/if}
    </div>
    <div class="flex items-center justify-end gap-3">
      <button
        type="button"
        onclick={closeDeleteModal}
        class="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!canConfirmDelete || isDeleting}
        class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDeleting ? "Deleting…" : "Delete team"}
      </button>
    </div>
  </form>
</Modal>
