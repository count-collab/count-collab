<script lang="ts">
  import { goto } from "$app/navigation";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import { slugify } from "$lib/counter";
  import { teamRoleLabels } from "$lib/roles";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const roleBadgeClasses: Record<string, string> = {
    owner:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-700/60",
    admin:
      "bg-purple-50 text-purple-700 ring-1 ring-purple-200/60 dark:bg-purple-900/30 dark:text-purple-400 dark:ring-purple-700/60",
  };
  const defaultRoleBadgeClass =
    "bg-slate-50 text-slate-600 ring-1 ring-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/60";

  type CreateErrors = { name?: string; description?: string; general?: string };

  let showCreateModal = $state(false);
  let name = $state("");
  let description = $state("");
  let createErrors = $state<CreateErrors>({});
  let isCreating = $state(false);
  let nameInput = $state<HTMLInputElement | null>(null);
  let createButton = $state<HTMLButtonElement | null>(null);

  function openCreateModal() {
    name = "";
    description = "";
    createErrors = {};
    showCreateModal = true;
    setTimeout(() => nameInput?.focus(), 50);
  }

  function closeCreateModal() {
    showCreateModal = false;
    createButton?.focus();
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (isCreating) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      createErrors = { name: "Name is required" };
      nameInput?.focus();
      return;
    }

    isCreating = true;
    createErrors = {};

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          createErrors = {
            general: `You're creating teams too quickly. Please wait ${body.retryAfterSeconds ?? 60}s and try again.`,
          };
          return;
        }
        if (body.errors) {
          createErrors = {
            name: body.errors.name?.[0],
            description: body.errors.description?.[0],
          };
          return;
        }
        createErrors = {
          general: body.error ?? body.message ?? "Failed to create team.",
        };
        return;
      }

      showCreateModal = false;
      await goto(`/t/${body.id}/${slugify(body.name)}`);
    } catch {
      createErrors = { general: "Network error. Please try again." };
    } finally {
      isCreating = false;
    }
  }
</script>

<MetaTags
  title="My Teams | Count Collab"
  description="Teams you belong to and the counters and dashboards they share."
  path="/my/teams"
/>

<section>
  <div class="flex items-center justify-between gap-2 mb-4">
    <div class="flex items-center gap-2">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Teams
      </h2>
      <span
        class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"
      >
        {data.teams.length}
      </span>
    </div>
    <button
      type="button"
      bind:this={createButton}
      onclick={openCreateModal}
      class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-1.5"
    >
      <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
      Create team
    </button>
  </div>

  {#if data.teams.length === 0}
    <div
      class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
    >
      <ion-icon
        name="people-outline"
        class="text-slate-300 dark:text-slate-600"
        style="font-size: 40px;"
      ></ion-icon>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Share a group of counters and dashboards with the same people.
      </p>
      <button
        type="button"
        onclick={openCreateModal}
        class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        <ion-icon name="add-circle-outline" style="font-size: 16px;"></ion-icon>
        Create your first team
      </button>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each data.teams as team (team.id)}
        <a
          href={`/t/${team.id}/${slugify(team.name)}`}
          class="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-5 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg hover:ring-blue-100 dark:hover:ring-blue-900 hover:-translate-y-0.5 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <span
            class="relative font-semibold text-slate-900 dark:text-slate-100 truncate"
          >
            {team.name}
          </span>
          <span
            class="relative text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate min-h-5"
          >
            {team.description ?? ""}
          </span>
          <div
            class="relative flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400"
          >
            <span class="inline-flex items-center gap-1">
              <ion-icon name="people-outline" style="font-size: 14px;"
              ></ion-icon>
              {team.memberCount}
              {team.memberCount === 1 ? "member" : "members"}
            </span>
            <span class="inline-flex items-center gap-1">
              <ion-icon name="pulse-outline" style="font-size: 14px;"
              ></ion-icon>
              {team.counterCount}
              {team.counterCount === 1 ? "counter" : "counters"}
            </span>
            <span class="inline-flex items-center gap-1">
              <ion-icon name="apps-outline" style="font-size: 14px;"></ion-icon>
              {team.dashboardCount}
              {team.dashboardCount === 1 ? "dashboard" : "dashboards"}
            </span>
          </div>
          <div class="relative flex flex-wrap gap-1.5 mt-2">
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full {roleBadgeClasses[
                team.role
              ] ?? defaultRoleBadgeClass}"
            >
              {teamRoleLabels[team.role]}
            </span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</section>

<Modal
  bind:open={showCreateModal}
  title="Create team"
  onclose={() => createButton?.focus()}
>
  <form onsubmit={handleCreate} class="space-y-4" novalidate>
    <div aria-live="polite">
      {#if createErrors.general}
        <p
          role="alert"
          class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {createErrors.general}
        </p>
      {/if}
    </div>

    <div>
      <label
        for="create-team-name"
        class="block text-sm text-slate-700 dark:text-slate-300 mb-1"
      >
        Name
      </label>
      <input
        id="create-team-name"
        type="text"
        bind:this={nameInput}
        bind:value={name}
        required
        maxlength={50}
        autocomplete="off"
        aria-invalid={createErrors.name ? "true" : undefined}
        aria-describedby={createErrors.name ? "create-team-name-error" : undefined}
        class="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      {#if createErrors.name}
        <p
          id="create-team-name-error"
          role="alert"
          class="mt-1 text-sm text-red-600 dark:text-red-400"
        >
          {createErrors.name}
        </p>
      {/if}
    </div>

    <div>
      <label
        for="create-team-description"
        class="block text-sm text-slate-700 dark:text-slate-300 mb-1"
      >
        Description <span class="text-slate-400 dark:text-slate-500"
          >(optional)</span
        >
      </label>
      <textarea
        id="create-team-description"
        bind:value={description}
        maxlength={500}
        rows={3}
        aria-invalid={createErrors.description ? "true" : undefined}
        aria-describedby={createErrors.description
          ? "create-team-description-error"
          : undefined}
        class="w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
      ></textarea>
      {#if createErrors.description}
        <p
          id="create-team-description-error"
          role="alert"
          class="mt-1 text-sm text-red-600 dark:text-red-400"
        >
          {createErrors.description}
        </p>
      {/if}
    </div>

    <div class="flex items-center justify-end gap-3">
      <button
        type="button"
        onclick={closeCreateModal}
        class="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isCreating}
        class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
      >
        {isCreating ? "Creating…" : "Create team"}
      </button>
    </div>
  </form>
</Modal>
