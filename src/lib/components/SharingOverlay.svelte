<script lang="ts">
  import { fade } from "svelte/transition";

  type Member = {
    id: number;
    userId: string;
    role: string;
    username: string | null;
    name: string | null;
    image: string | null;
  };

  type Invitation = {
    id: number;
    userId: string;
    role: string;
    username: string | null;
    name: string | null;
    image: string | null;
    inviterUsername: string | null;
    createdAt: string | Date;
  };

  type Props = {
    open: boolean;
    type: "counter" | "dashboard";
    entityId: string;
    entityTitle: string;
    shareUrl: string;
    shareToken: string | null;
    visibilityMode: "public" | "private" | "public_readonly";
    members: Member[];
    invitations: Invitation[];
    canManage: boolean;
    isMember: boolean;
    currentUserId: string | null;
    onupdate: () => void;
  };

  let {
    open = $bindable(),
    type,
    entityId,
    entityTitle,
    shareUrl,
    shareToken,
    visibilityMode,
    members,
    invitations,
    canManage,
    isMember,
    currentUserId,
    onupdate,
  }: Props = $props();

  const typePrefix = $derived(type === "counter" ? "c" : "d");
  const entityLabel = $derived(type === "counter" ? "counter" : "dashboard");

  const roleOptions = $derived(
    type === "counter"
      ? [
          { value: "viewer", label: "Viewer" },
          { value: "incrementer", label: "Incrementer" },
          { value: "editor", label: "Editor" },
          { value: "admin", label: "Admin" },
        ]
      : [
          { value: "viewer", label: "Viewer" },
          { value: "editor", label: "Editor" },
          { value: "admin", label: "Admin" },
        ],
  );

  function getRoleLabel(role: string): string {
    const found = roleOptions.find((r) => r.value === role);
    return found?.label ?? role;
  }

  // Copy link state
  let copySuccess = $state(false);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copySuccess = true;
      setTimeout(() => (copySuccess = false), 2000);
    } catch {
      // fallback: text is already select-all
    }
  }

  // Invite state
  let inviteUsername = $state("");
  let inviteRole = $state("viewer");
  let inviteError = $state<string | null>(null);
  let inviteSuccess = $state<string | null>(null);
  let isInviting = $state(false);

  async function handleInvite() {
    if (isInviting || !inviteUsername.trim()) return;
    isInviting = true;
    inviteError = null;
    inviteSuccess = null;

    try {
      const response = await fetch(`/${typePrefix}/${entityId}/members`, {
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
      onupdate();
    } catch {
      inviteError = "Network error. Please try again.";
    } finally {
      isInviting = false;
    }
  }

  // Invitation management
  async function handleUpdateInvitationRole(userId: string, role: string) {
    try {
      const response = await fetch(
        `/${typePrefix}/${entityId}/invitations/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      if (response.ok) {
        onupdate();
      }
    } catch {
      // silently fail
    }
  }

  async function handleRevokeInvitation(userId: string) {
    try {
      const response = await fetch(
        `/${typePrefix}/${entityId}/invitations/${userId}`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) {
        onupdate();
      }
    } catch {
      // silently fail
    }
  }

  // Member management
  async function handleUpdateMemberRole(userId: string, role: string) {
    try {
      const response = await fetch(
        `/${typePrefix}/${entityId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      if (response.ok) {
        onupdate();
      }
    } catch {
      // silently fail
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const response = await fetch(
        `/${typePrefix}/${entityId}/members/${userId}`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) {
        onupdate();
      }
    } catch {
      // silently fail
    }
  }

  // Leave state
  let showLeaveConfirm = $state(false);
  let isLeaving = $state(false);

  async function handleLeave() {
    if (isLeaving || !currentUserId) return;
    isLeaving = true;

    try {
      const response = await fetch(
        `/${typePrefix}/${entityId}/members/${currentUserId}`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) {
        onupdate();
        close();
      }
    } catch {
      // silently fail
    } finally {
      isLeaving = false;
    }
  }

  function close() {
    showLeaveConfirm = false;
    inviteError = null;
    inviteSuccess = null;
    inviteUsername = "";
    inviteRole = "viewer";
    open = false;
  }

  // Body scroll lock
  $effect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  });

  const visibilityBadgeClasses: Record<string, string> = {
    public:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    public_readonly:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    private:
      "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };

  const visibilityLabels: Record<string, string> = {
    public: "Public",
    public_readonly: "Read-only",
    private: "Private",
  };
</script>

<svelte:window
  onkeydown={(e) => {
    if (open && e.key === "Escape") close();
  }}
/>

{#if open}
  <div
    class="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900"
    role="dialog"
    aria-modal="true"
    aria-label="Sharing"
    transition:fade={{ duration: 150 }}
  >
    <!-- Header bar -->
    <div
      class="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700"
    >
      <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
        Sharing
      </h2>
      <button
        type="button"
        onclick={close}
        class="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Close"
      >
        <ion-icon name="close-outline" style="font-size: 24px;"></ion-icon>
      </button>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto pb-24">
      <div class="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <!-- Section 1: Shareable Link -->
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Shareable link
          </h3>
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
                <ion-icon name="copy-outline" style="font-size: 16px;"
                ></ion-icon>
                Copy
              {/if}
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            {#if visibilityMode === "public_readonly"}
              <span
                class="text-xs px-2 py-0.5 rounded-full {visibilityBadgeClasses.public}"
              >
                Public
              </span>
              <span
                class="text-xs px-2 py-0.5 rounded-full {visibilityBadgeClasses.public_readonly}"
              >
                read-only
              </span>
            {:else}
              <span
                class="text-xs px-2 py-0.5 rounded-full {visibilityBadgeClasses[
                  visibilityMode
                ]}"
              >
                {visibilityLabels[visibilityMode]}
              </span>
            {/if}
          </div>

          {#if visibilityMode === "private" && shareToken}
            <p class="text-xs text-amber-600 dark:text-amber-400">
              Anyone with this link can access this private {entityLabel}.
            </p>
          {/if}
        </section>

        <!-- Section 2: Invite Member -->
        {#if canManage}
          <section class="space-y-4">
            <h3
              class="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Invite member
            </h3>
            <div class="flex gap-2 items-end">
              <div class="flex-1">
                <label
                  class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  for="sharing-invite-username">Username</label
                >
                <input
                  id="sharing-invite-username"
                  type="text"
                  bind:value={inviteUsername}
                  placeholder="username"
                  class="w-full h-9 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
                />
              </div>
              <div>
                <label
                  class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  for="sharing-invite-role">Role</label
                >
                <select
                  id="sharing-invite-role"
                  bind:value={inviteRole}
                  class="h-9 rounded-md border border-slate-300 px-3 text-sm bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400"
                >
                  {#each roleOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
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
              <p class="text-sm text-red-600 dark:text-red-400">
                {inviteError}
              </p>
            {/if}
            {#if inviteSuccess}
              <p class="text-sm text-green-600 dark:text-green-400">
                {inviteSuccess}
              </p>
            {/if}
          </section>
        {/if}

        <!-- Section 3: Pending Invitations -->
        {#if canManage && invitations.length > 0}
          <section class="space-y-4">
            <h3
              class="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Pending invitations
            </h3>
            <ul class="divide-y divide-slate-200 dark:divide-slate-700">
              {#each invitations as invitation (invitation.id)}
                <li class="flex items-center justify-between py-3">
                  <div class="flex items-center gap-3">
                    {#if invitation.image}
                      <img
                        src={invitation.image}
                        alt=""
                        class="w-8 h-8 rounded-full"
                      />
                    {:else}
                      <div
                        class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      >
                        {(invitation.username ?? "?")[0]}
                      </div>
                    {/if}
                    <div>
                      <p
                        class="text-sm font-medium text-slate-900 dark:text-slate-100"
                      >
                        {invitation.username ?? invitation.name ?? "Unknown"}
                      </p>
                      {#if invitation.inviterUsername}
                        <p class="text-xs text-slate-400 dark:text-slate-500">
                          Invited by @{invitation.inviterUsername}
                        </p>
                      {/if}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <select
                      value={invitation.role}
                      onchange={(e) =>
                        handleUpdateInvitationRole(
                          invitation.userId,
                          e.currentTarget.value,
                        )}
                      class="h-9 rounded-md border border-slate-300 px-3 text-sm bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400"
                    >
                      {#each roleOptions as opt}
                        <option value={opt.value}>{opt.label}</option>
                      {/each}
                    </select>
                    <button
                      type="button"
                      onclick={() => handleRevokeInvitation(invitation.userId)}
                      class="p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Revoke invitation for {invitation.username ??
                        'user'}"
                    >
                      <ion-icon name="close-outline" style="font-size: 18px;"
                      ></ion-icon>
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        <!-- Section 4: Members (only visible to managers) -->
        {#if canManage}
          <section class="space-y-4">
            <h3
              class="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Members
            </h3>
            {#if members.length > 0}
              <ul class="divide-y divide-slate-200 dark:divide-slate-700">
                {#each members as member (member.id)}
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
                      <p
                        class="text-sm font-medium text-slate-900 dark:text-slate-100"
                      >
                        {member.username ?? member.name ?? "Unknown"}
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      {#if canManage}
                        <select
                          value={member.role}
                          onchange={(e) =>
                            handleUpdateMemberRole(
                              member.userId,
                              e.currentTarget.value,
                            )}
                          class="h-9 rounded-md border border-slate-300 px-3 text-sm bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400"
                        >
                          {#each roleOptions as opt}
                            <option value={opt.value}>{opt.label}</option>
                          {/each}
                        </select>
                        <button
                          type="button"
                          onclick={() => handleRemoveMember(member.userId)}
                          class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Remove
                        </button>
                      {:else}
                        <span
                          class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        >
                          {getRoleLabel(member.role)}
                        </span>
                      {/if}
                    </div>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="text-sm text-slate-500 dark:text-slate-400">
                No members yet.
              </p>
            {/if}
          </section>
        {/if}

        <!-- Section 5: Leave -->
        {#if isMember && !canManage}
          <section class="space-y-4">
            {#if showLeaveConfirm}
              <div
                class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 space-y-3"
              >
                <p class="text-sm text-red-700 dark:text-red-300">
                  Are you sure you want to leave this {entityLabel}? You will
                  lose your current role.
                </p>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    onclick={handleLeave}
                    disabled={isLeaving}
                    class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {isLeaving ? "Leaving…" : "Confirm leave"}
                  </button>
                  <button
                    type="button"
                    onclick={() => (showLeaveConfirm = false)}
                    class="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            {:else}
              <button
                type="button"
                onclick={() => (showLeaveConfirm = true)}
                class="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
              >
                Leave {entityLabel}
              </button>
            {/if}
          </section>
        {/if}
      </div>
    </div>

    <!-- Fixed bottom bar -->
    {#if canManage}
      <div
        class="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
      >
        <div class="max-w-2xl mx-auto flex items-center justify-end">
          <button
            type="button"
            onclick={close}
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Done
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}
