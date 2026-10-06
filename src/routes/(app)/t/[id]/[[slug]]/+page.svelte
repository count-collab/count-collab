<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import CounterCard from "$lib/components/CounterCard.svelte";
  import DashboardCard from "$lib/components/DashboardCard.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import Switch from "$lib/components/Switch.svelte";
  import { slugify } from "$lib/counter";
  import type { TeamJoinLinkRole, TeamMemberRole } from "$lib/db/schema";
  import { canAssignTeamRole, teamRoleLabels, teamRoleOrder } from "$lib/roles";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  type TabId = "counters" | "dashboards" | "members" | "settings";
  type Tab = { id: TabId; label: string; icon: string; count?: number };

  // Mirrors teamJoinLinkRoles; the schema module can't be imported client-side
  const joinLinkRoles: TeamJoinLinkRole[] = ["viewer", "incrementer", "editor"];

  const inputClass =
    "w-full px-3 py-2 border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500";
  const selectClass =
    "h-9 rounded-md border border-slate-300 px-3 text-sm bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400";
  const roleBadgeClass = (role: TeamMemberRole) =>
    role === "owner"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

  const teamId = $derived(data.team.id);
  const currentUserId = $derived(data.session?.user?.id ?? null);
  const myMembership = $derived(
    data.members.find((m) => m.userId === currentUserId) ?? null,
  );
  // data.role is the acting role, which can be "owner" for platform admins who aren't members
  const displayRole = $derived(myMembership?.role ?? data.role);

  // ── Tabs ──
  const tabs = $derived<Tab[]>([
    {
      id: "counters",
      label: "Counters",
      icon: "pulse-outline",
      count: data.resources.counters.length,
    },
    {
      id: "dashboards",
      label: "Dashboards",
      icon: "apps-outline",
      count: data.resources.dashboards.length,
    },
    {
      id: "members",
      label: "Members",
      icon: "people-outline",
      count: data.members.length,
    },
    ...(data.canManage
      ? [{ id: "settings" as const, label: "Settings", icon: "settings-outline" }]
      : []),
  ]);

  let selectedTab = $state<TabId>("counters");
  const activeTab = $derived<TabId>(
    tabs.some((t) => t.id === selectedTab) ? selectedTab : "counters",
  );

  function handleTabKeydown(event: KeyboardEvent, index: number) {
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    const next = tabs[(targets[event.key] + tabs.length) % tabs.length];
    selectedTab = next.id;
    document.getElementById(`team-tab-${next.id}`)?.focus();
  }

  // ── Helpers ──
  type SendResult =
    | { ok: true; body: Record<string, unknown> }
    | { ok: false; error: string };

  async function send(
    url: string,
    method: string,
    payload?: unknown,
  ): Promise<SendResult> {
    try {
      const response = await fetch(url, {
        method,
        headers:
          payload === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fieldError = Object.values(
          (body.errors ?? {}) as Record<string, string[] | undefined>,
        ).flat()[0];
        return {
          ok: false,
          error:
            body.error ??
            body.message ??
            fieldError ??
            "Something went wrong. Please try again.",
        };
      }
      return { ok: true, body };
    } catch {
      return { ok: false, error: "Network error. Please try again." };
    }
  }

  function focusSoon(el: HTMLElement | null) {
    setTimeout(() => el?.focus(), 50);
  }

  function assignableRoles(currentRole: TeamMemberRole | null): TeamMemberRole[] {
    return teamRoleOrder.filter(
      (r) => r === currentRole || canAssignTeamRole(data.role, currentRole, r),
    );
  }

  // ── Leave ──
  let showLeaveModal = $state(false);
  let leaveError = $state<string | null>(null);
  let isLeaving = $state(false);
  let leaveButton = $state<HTMLButtonElement | null>(null);
  let leaveCancelButton = $state<HTMLButtonElement | null>(null);

  function openLeaveModal() {
    leaveError = null;
    showLeaveModal = true;
    focusSoon(leaveCancelButton);
  }

  function closeLeaveModal() {
    showLeaveModal = false;
    leaveButton?.focus();
  }

  async function handleLeave() {
    if (isLeaving || !currentUserId) return;
    isLeaving = true;
    leaveError = null;
    const result = await send(
      `/t/${teamId}/members/${currentUserId}`,
      "DELETE",
    );
    isLeaving = false;
    if (!result.ok) {
      leaveError = result.error;
      return;
    }
    showLeaveModal = false;
    await goto("/my/teams");
  }

  // ── Members ──
  let membersError = $state<string | null>(null);

  async function handleMemberRoleChange(
    select: HTMLSelectElement,
    userId: string,
    currentRole: TeamMemberRole,
  ) {
    membersError = null;
    const result = await send(`/t/${teamId}/members/${userId}`, "PATCH", {
      role: select.value,
    });
    if (!result.ok) {
      select.value = currentRole;
      membersError = result.error;
      return;
    }
    await invalidateAll();
  }

  async function handleRemoveMember(userId: string) {
    membersError = null;
    const result = await send(`/t/${teamId}/members/${userId}`, "DELETE");
    if (!result.ok) {
      membersError = result.error;
      return;
    }
    await invalidateAll();
  }

  // ── Invite ──
  let inviteUsername = $state("");
  let inviteRole = $state<TeamMemberRole>("viewer");
  let inviteError = $state<string | null>(null);
  let inviteSuccess = $state<string | null>(null);
  let isInviting = $state(false);
  const inviteRoleOptions = $derived(assignableRoles(null));

  async function handleInvite(event: SubmitEvent) {
    event.preventDefault();
    const username = inviteUsername.trim();
    if (isInviting || !username) return;
    isInviting = true;
    inviteError = null;
    inviteSuccess = null;
    const result = await send(`/t/${teamId}/members`, "POST", {
      username,
      role: inviteRole,
    });
    isInviting = false;
    if (!result.ok) {
      inviteError = result.error;
      return;
    }
    inviteSuccess = `Invited ${username} as ${teamRoleLabels[inviteRole]}`;
    inviteUsername = "";
    await invalidateAll();
  }

  // ── Invitations ──
  async function handleInvitationRoleChange(
    select: HTMLSelectElement,
    userId: string,
    currentRole: TeamMemberRole,
  ) {
    membersError = null;
    const result = await send(
      `/t/${teamId}/invitations/${userId}`,
      "PATCH",
      { role: select.value },
    );
    if (!result.ok) {
      select.value = currentRole;
      membersError = result.error;
      return;
    }
    await invalidateAll();
  }

  async function handleCancelInvitation(userId: string) {
    membersError = null;
    const result = await send(`/t/${teamId}/invitations/${userId}`, "DELETE");
    if (!result.ok) {
      membersError = result.error;
      return;
    }
    await invalidateAll();
  }

  // ── Settings: details ──
  // null = untouched, so the fields follow fresh server data until edited
  let editName = $state<string | null>(null);
  let editDescription = $state<string | null>(null);
  let detailsError = $state<string | null>(null);
  let detailsSuccess = $state<string | null>(null);
  let isSavingDetails = $state(false);

  async function handleSaveDetails(event: SubmitEvent) {
    event.preventDefault();
    if (isSavingDetails) return;
    const name = (editName ?? data.team.name).trim();
    if (!name) {
      detailsError = "Name is required";
      return;
    }
    isSavingDetails = true;
    detailsError = null;
    detailsSuccess = null;
    const result = await send(`/api/teams/${teamId}`, "PATCH", {
      name,
      description:
        (editDescription ?? data.team.description ?? "").trim() || null,
    });
    isSavingDetails = false;
    if (!result.ok) {
      detailsError = result.error;
      return;
    }
    editName = null;
    editDescription = null;
    detailsSuccess = "Team details saved.";
    await goto(`/t/${teamId}/${slugify(name)}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
      invalidateAll: true,
    });
  }

  // ── Settings: join link ──
  let joinLinkError = $state<string | null>(null);
  let isUpdatingJoinLink = $state(false);
  let copySuccess = $state(false);
  let showResetModal = $state(false);
  let resetButton = $state<HTMLButtonElement | null>(null);
  let resetCancelButton = $state<HTMLButtonElement | null>(null);

  const joinEnabled = $derived(!!data.joinToken);
  const joinUrl = $derived(
    data.joinToken
      ? `${$page.url.origin}/t/${teamId}/join?token=${encodeURIComponent(data.joinToken)}`
      : "",
  );

  async function setJoinLinkEnabled(enabled: boolean) {
    if (isUpdatingJoinLink) return;
    isUpdatingJoinLink = true;
    joinLinkError = null;
    const result = await send(
      `/api/teams/${teamId}/join-link`,
      enabled ? "POST" : "DELETE",
    );
    if (result.ok) {
      await invalidateAll();
    } else {
      joinLinkError = result.error;
    }
    isUpdatingJoinLink = false;
  }

  async function handleJoinRoleChange(select: HTMLSelectElement) {
    joinLinkError = null;
    const result = await send(`/api/teams/${teamId}/join-link`, "PATCH", {
      role: select.value,
    });
    if (!result.ok) {
      select.value = data.joinRole ?? "viewer";
      joinLinkError = result.error;
      return;
    }
    await invalidateAll();
  }

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      copySuccess = true;
      setTimeout(() => (copySuccess = false), 2000);
    } catch {
      // fallback: text is already select-all
    }
  }

  function openResetModal() {
    showResetModal = true;
    focusSoon(resetCancelButton);
  }

  function closeResetModal() {
    showResetModal = false;
    resetButton?.focus();
  }

  async function handleResetLink() {
    await setJoinLinkEnabled(true);
    closeResetModal();
  }

  // ── Settings: delete ──
  let showDeleteModal = $state(false);
  let deleteConfirmName = $state("");
  let deleteError = $state<string | null>(null);
  let isDeleting = $state(false);
  let deleteButton = $state<HTMLButtonElement | null>(null);
  let deleteInput = $state<HTMLInputElement | null>(null);

  const canConfirmDelete = $derived(deleteConfirmName === data.team.name);
  const counterTotal = $derived(data.resources.counters.length);
  const dashboardTotal = $derived(data.resources.dashboards.length);

  function openDeleteModal() {
    deleteConfirmName = "";
    deleteError = null;
    showDeleteModal = true;
    focusSoon(deleteInput);
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deleteButton?.focus();
  }

  async function handleDelete(event: SubmitEvent) {
    event.preventDefault();
    if (!canConfirmDelete || isDeleting) return;
    isDeleting = true;
    deleteError = null;
    const result = await send(`/api/teams/${teamId}`, "DELETE", {
      confirmName: deleteConfirmName,
    });
    isDeleting = false;
    if (!result.ok) {
      deleteError = result.error;
      return;
    }
    showDeleteModal = false;
    await goto("/my/teams");
  }
</script>

<MetaTags
  title={data.title}
  description={data.team.description ?? `${data.team.name} on Count Collab`}
  path="/t/{data.team.id}/{slugify(data.team.name)}"
/>

<div class="flex flex-col">
  <!-- Header -->
  <header class="pb-6">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <h1
          class="text-xl font-bold text-slate-900 dark:text-slate-100 break-words"
        >
          {data.team.name}
        </h1>
        {#if data.team.description}
          <p
            class="text-sm text-slate-500 dark:text-slate-400 mt-0.5 break-words"
          >
            {data.team.description}
          </p>
        {/if}
      </div>

      {#if myMembership}
        <button
          type="button"
          bind:this={leaveButton}
          onclick={openLeaveModal}
          class="shrink-0 ml-4 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition inline-flex items-center gap-1.5 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          <ion-icon name="exit-outline" style="font-size: 16px;"></ion-icon>
          Leave team
        </button>
      {/if}
    </div>

    <div class="flex flex-wrap items-center gap-2 mt-2">
      {#if displayRole}
        <span
          class="text-xs px-2 py-0.5 rounded-full {roleBadgeClass(displayRole)}"
        >
          <span class="sr-only">Your role:</span>
          {teamRoleLabels[displayRole]}
        </span>
      {/if}
      <span class="text-xs text-slate-400 dark:text-slate-500">
        Created {new Date(data.team.createdAt).toLocaleDateString()}
      </span>
    </div>
  </header>

  <!-- Tabs -->
  <div
    role="tablist"
    aria-label="Team sections"
    class="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-8 overflow-x-auto"
  >
    {#each tabs as tab, index (tab.id)}
      <button
        type="button"
        role="tab"
        id="team-tab-{tab.id}"
        aria-selected={activeTab === tab.id}
        aria-controls="team-tabpanel"
        tabindex={activeTab === tab.id ? 0 : -1}
        onclick={() => (selectedTab = tab.id)}
        onkeydown={(e) => handleTabKeydown(e, index)}
        class="inline-flex items-center gap-1.5 px-4 py-2 -mb-px text-sm font-medium whitespace-nowrap transition-all {activeTab ===
        tab.id
          ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}"
      >
        <ion-icon name={tab.icon} style="font-size: 16px;"></ion-icon>
        {tab.label}
        {#if tab.count !== undefined}
          <span
            class="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            {tab.count}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <div
    id="team-tabpanel"
    role="tabpanel"
    aria-labelledby="team-tab-{activeTab}"
  >
    {#if activeTab === "counters"}
      <section>
        {#if data.canEditResources}
          <div class="flex justify-end mb-4">
            <a
              href="/create?teamId={data.team.id}"
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-1.5"
            >
              <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
              New counter
            </a>
          </div>
        {/if}
        {#if data.resources.counters.length === 0}
          <div
            class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
          >
            <ion-icon
              name="pulse-outline"
              class="text-slate-300 dark:text-slate-600"
              style="font-size: 40px;"
            ></ion-icon>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This team doesn't have any counters yet.
            </p>
          </div>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {#each data.resources.counters as counter (counter.id)}
              <CounterCard {counter} />
            {/each}
          </div>
        {/if}
      </section>
    {:else if activeTab === "dashboards"}
      <section>
        {#if data.resources.dashboards.length === 0}
          <div
            class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
          >
            <ion-icon
              name="apps-outline"
              class="text-slate-300 dark:text-slate-600"
              style="font-size: 40px;"
            ></ion-icon>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This team doesn't have any dashboards yet.
            </p>
          </div>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {#each data.resources.dashboards as dashboard (dashboard.id)}
              <DashboardCard {dashboard} />
            {/each}
          </div>
        {/if}
      </section>
    {:else if activeTab === "members"}
      <div class="max-w-2xl space-y-8">
        {#if data.canManage}
          <section class="space-y-4">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Invite member
            </h2>
            <form onsubmit={handleInvite} class="flex gap-2 items-end">
              <div class="flex-1">
                <label
                  class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  for="team-invite-username">Username</label
                >
                <input
                  id="team-invite-username"
                  type="text"
                  bind:value={inviteUsername}
                  placeholder="username"
                  autocomplete="off"
                  class="w-full h-9 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
                />
              </div>
              <div>
                <label
                  class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  for="team-invite-role">Role</label
                >
                <select
                  id="team-invite-role"
                  bind:value={inviteRole}
                  class={selectClass}
                >
                  {#each inviteRoleOptions as r (r)}
                    <option value={r}>{teamRoleLabels[r]}</option>
                  {/each}
                </select>
              </div>
              <button
                type="submit"
                disabled={isInviting || !inviteUsername.trim()}
                class="h-9 px-4 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              >
                Invite
              </button>
            </form>

            <div aria-live="polite">
              {#if inviteError}
                <p role="alert" class="text-sm text-red-600 dark:text-red-400">
                  {inviteError}
                </p>
              {/if}
              {#if inviteSuccess}
                <p class="text-sm text-green-600 dark:text-green-400">
                  {inviteSuccess}
                </p>
              {/if}
            </div>
          </section>
        {/if}

        <div aria-live="polite">
          {#if membersError}
            <p role="alert" class="text-sm text-red-600 dark:text-red-400">
              {membersError}
            </p>
          {/if}
        </div>

        {#if data.canManage && data.invitations.length > 0}
          <section class="space-y-4">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Pending invitations
            </h2>
            <ul class="divide-y divide-slate-200 dark:divide-slate-700">
              {#each data.invitations as invitation (invitation.id)}
                {@const label =
                  invitation.username ?? invitation.name ?? "Unknown"}
                <li class="flex items-center justify-between gap-3 py-3">
                  <div class="flex items-center gap-3 min-w-0">
                    {#if invitation.image}
                      <img
                        src={invitation.image}
                        alt=""
                        class="w-8 h-8 rounded-full"
                      />
                    {:else}
                      <div
                        class="w-8 h-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      >
                        {(invitation.username ?? "?")[0]}
                      </div>
                    {/if}
                    <div class="min-w-0">
                      <p
                        class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate"
                      >
                        {label}
                      </p>
                      {#if invitation.inviterUsername}
                        <p class="text-xs text-slate-400 dark:text-slate-500">
                          Invited by @{invitation.inviterUsername}
                        </p>
                      {/if}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    {#if canAssignTeamRole(data.role, invitation.role, null)}
                      <select
                        value={invitation.role}
                        aria-label="Role for invitation to {label}"
                        onchange={(e) =>
                          handleInvitationRoleChange(
                            e.currentTarget,
                            invitation.userId,
                            invitation.role,
                          )}
                        class={selectClass}
                      >
                        {#each assignableRoles(invitation.role) as r (r)}
                          <option value={r}>{teamRoleLabels[r]}</option>
                        {/each}
                      </select>
                      <button
                        type="button"
                        onclick={() => handleCancelInvitation(invitation.userId)}
                        class="p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Cancel invitation for {label}"
                      >
                        <ion-icon name="close-outline" style="font-size: 18px;"
                        ></ion-icon>
                      </button>
                    {:else}
                      <span
                        class="text-xs px-2 py-0.5 rounded-full {roleBadgeClass(
                          invitation.role,
                        )}"
                      >
                        {teamRoleLabels[invitation.role]}
                      </span>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        <section class="space-y-4">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Members
          </h2>
          <ul class="divide-y divide-slate-200 dark:divide-slate-700">
            {#each data.members as member (member.userId)}
              {@const label = member.name ?? member.username ?? "Unknown"}
              {@const isSelf = member.userId === currentUserId}
              {@const canModify =
                data.canManage && canAssignTeamRole(data.role, member.role, null)}
              <li class="flex items-center justify-between gap-3 py-3">
                <div class="flex items-center gap-3 min-w-0">
                  {#if member.image}
                    <img src={member.image} alt="" class="w-8 h-8 rounded-full" />
                  {:else}
                    <div
                      class="w-8 h-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                    >
                      {(member.username ?? "?")[0]}
                    </div>
                  {/if}
                  <div class="min-w-0">
                    <p
                      class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate"
                    >
                      {label}
                      {#if isSelf}
                        <span class="text-xs font-normal text-slate-400 dark:text-slate-500"
                          >(you)</span
                        >
                      {/if}
                    </p>
                    <p class="text-xs text-slate-400 dark:text-slate-500">
                      {#if member.username}@{member.username} ·
                      {/if}Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  {#if canModify}
                    <select
                      value={member.role}
                      aria-label="Role for {label}"
                      onchange={(e) =>
                        handleMemberRoleChange(
                          e.currentTarget,
                          member.userId,
                          member.role,
                        )}
                      class={selectClass}
                    >
                      {#each assignableRoles(member.role) as r (r)}
                        <option value={r}>{teamRoleLabels[r]}</option>
                      {/each}
                    </select>
                    {#if !isSelf}
                      <button
                        type="button"
                        onclick={() => handleRemoveMember(member.userId)}
                        class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        aria-label="Remove {label}"
                      >
                        Remove
                      </button>
                    {/if}
                  {:else}
                    <span
                      class="text-xs px-2 py-0.5 rounded-full {roleBadgeClass(
                        member.role,
                      )}"
                    >
                      {teamRoleLabels[member.role]}
                    </span>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        </section>
      </div>
    {:else if activeTab === "settings" && data.canManage}
      <div class="max-w-2xl space-y-8">
        <section
          class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4"
        >
          <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Team details
          </h2>
          <form onsubmit={handleSaveDetails} class="space-y-4" novalidate>
            <div>
              <label
                for="team-settings-name"
                class="block text-sm text-slate-700 dark:text-slate-300 mb-1"
              >
                Name
              </label>
              <input
                id="team-settings-name"
                type="text"
                required
                maxlength={50}
                autocomplete="off"
                bind:value={
                  () => editName ?? data.team.name, (v) => (editName = v)
                }
                class={inputClass}
              />
            </div>
            <div>
              <label
                for="team-settings-description"
                class="block text-sm text-slate-700 dark:text-slate-300 mb-1"
              >
                Description <span class="text-slate-400 dark:text-slate-500"
                  >(optional)</span
                >
              </label>
              <textarea
                id="team-settings-description"
                rows={3}
                maxlength={500}
                bind:value={
                  () => editDescription ?? data.team.description ?? "",
                  (v) => (editDescription = v)
                }
                class={inputClass}
              ></textarea>
            </div>
            <div aria-live="polite">
              {#if detailsError}
                <p role="alert" class="text-sm text-red-600 dark:text-red-400">
                  {detailsError}
                </p>
              {/if}
              {#if detailsSuccess}
                <p class="text-sm text-green-600 dark:text-green-400">
                  {detailsSuccess}
                </p>
              {/if}
            </div>
            <div class="flex justify-end">
              <button
                type="submit"
                disabled={isSavingDetails ||
                  (editName === null && editDescription === null)}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
              >
                {isSavingDetails ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </section>

        <section
          class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4"
        >
          <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Join link
          </h2>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Anyone signed in with this link can join the team.
          </p>
          <Switch
            bind:checked={
              () => joinEnabled, (v) => setJoinLinkEnabled(v)
            }
            label="Enable join link"
            disabled={isUpdatingJoinLink}
          />

          {#if joinEnabled}
            <div class="flex items-center gap-2">
              <p
                class="flex-1 text-sm text-slate-500 bg-slate-50 rounded-md px-3 py-2 font-mono select-all truncate dark:text-slate-400 dark:bg-slate-700"
                data-testid="team-join-url"
              >
                {joinUrl}
              </p>
              <button
                type="button"
                onclick={copyJoinLink}
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
                  <ion-icon name="copy-outline" style="font-size: 16px;"
                  ></ion-icon>
                  Copy
                {/if}
              </button>
            </div>

            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <label
                  class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  for="team-join-role">Joins as</label
                >
                <select
                  id="team-join-role"
                  value={data.joinRole ?? "viewer"}
                  onchange={(e) => handleJoinRoleChange(e.currentTarget)}
                  class={selectClass}
                >
                  {#each joinLinkRoles as r (r)}
                    <option value={r}>{teamRoleLabels[r]}</option>
                  {/each}
                </select>
              </div>
              <button
                type="button"
                bind:this={resetButton}
                onclick={openResetModal}
                disabled={isUpdatingJoinLink}
                class="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5 dark:border-slate-600 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <ion-icon name="refresh-outline" style="font-size: 16px;"
                ></ion-icon>
                Reset link
              </button>
            </div>
          {/if}

          <div aria-live="polite">
            {#if joinLinkError}
              <p role="alert" class="text-sm text-red-600 dark:text-red-400">
                {joinLinkError}
              </p>
            {/if}
          </div>
        </section>

        {#if data.canDelete}
          <section
            class="bg-white dark:bg-slate-800 rounded-lg border-2 border-red-200 dark:border-red-800 p-6 space-y-4"
          >
            <h2 class="text-xl font-semibold text-red-700 dark:text-red-400">
              Danger Zone
            </h2>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              Permanently delete this team together with all its counters and
              dashboards. This action cannot be undone.
            </p>
            <button
              type="button"
              bind:this={deleteButton}
              onclick={openDeleteModal}
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
            >
              Delete team
            </button>
          </section>
        {/if}
      </div>
    {/if}
  </div>
</div>

<Modal
  bind:open={showLeaveModal}
  title="Leave team?"
  describedBy="leave-team-description"
  onclose={() => leaveButton?.focus()}
>
  <div class="space-y-4">
    <p
      id="leave-team-description"
      class="text-sm text-slate-700 dark:text-slate-300"
    >
      You will lose access to {data.team.name} and its private counters and
      dashboards unless someone invites you again.
    </p>
    <div aria-live="polite">
      {#if leaveError}
        <p role="alert" class="text-sm text-red-600 dark:text-red-400">
          {leaveError}
        </p>
      {/if}
    </div>
    <div class="flex items-center justify-end gap-3">
      <button
        type="button"
        bind:this={leaveCancelButton}
        onclick={closeLeaveModal}
        class="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleLeave}
        disabled={isLeaving}
        class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
      >
        {isLeaving ? "Leaving…" : "Leave team"}
      </button>
    </div>
  </div>
</Modal>

<Modal
  bind:open={showResetModal}
  title="Reset join link?"
  describedBy="reset-join-link-description"
  onclose={() => resetButton?.focus()}
>
  <div class="space-y-4">
    <p
      id="reset-join-link-description"
      class="text-sm text-slate-700 dark:text-slate-300"
    >
      A new link will be generated. The current link stops working
      immediately, so anyone who hasn't joined yet will need the new one.
    </p>
    <div class="flex items-center justify-end gap-3">
      <button
        type="button"
        bind:this={resetCancelButton}
        onclick={closeResetModal}
        class="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleResetLink}
        disabled={isUpdatingJoinLink}
        class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
      >
        Reset link
      </button>
    </div>
  </div>
</Modal>

<Modal
  bind:open={showDeleteModal}
  title="Delete team?"
  describedBy="delete-team-description"
  onclose={() => deleteButton?.focus()}
>
  <form onsubmit={handleDelete} class="space-y-4">
    <div id="delete-team-description" class="space-y-2">
      <p class="text-sm text-slate-700 dark:text-slate-300">
        All {counterTotal}
        {counterTotal === 1 ? "counter" : "counters"} and {dashboardTotal}
        {dashboardTotal === 1 ? "dashboard" : "dashboards"} in this team will be
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
        Type <span class="font-semibold">{data.team.name}</span> to confirm
      </label>
      <input
        id="delete-team-confirm"
        type="text"
        bind:this={deleteInput}
        bind:value={deleteConfirmName}
        placeholder={data.team.name}
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
        class="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!canConfirmDelete || isDeleting}
        class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
      >
        {isDeleting ? "Deleting…" : "Delete team"}
      </button>
    </div>
  </form>
</Modal>
