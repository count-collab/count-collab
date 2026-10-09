<script lang="ts">
  import FullscreenOverlay from "$lib/components/FullscreenOverlay.svelte";
  import RoleDialog from "$lib/components/RoleDialog.svelte";
  import {
    counterRoleDescriptions,
    dashboardRoleDescriptions,
  } from "$lib/roles";

  type Member = {
    id: number;
    userId: string;
    role: string;
    username: string | null;
    image: string | null;
  };

  type Invitation = {
    id: number;
    userId: string;
    role: string;
    username: string | null;
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
    isDirectMember: boolean;
    currentUserId: string | null;
    team?: { id: string; name: string } | null;
    teamLinked?: boolean;
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
    isDirectMember,
    currentUserId,
    team = null,
    teamLinked = false,
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

  const roleDescriptions: Record<string, string> = $derived(
    type === "counter" ? counterRoleDescriptions : dashboardRoleDescriptions,
  );
  const roleDialogRoles = $derived(
    roleOptions.map((r) => ({
      ...r,
      description: roleDescriptions[r.value] ?? "",
    })),
  );

  let showRoleDialog = $state(false);
  let roleDialogMember = $state<{
    kind: "member" | "invitation";
    userId: string;
    username: string;
    role: string;
  } | null>(null);
  let roleDialogError = $state<string | null>(null);

  function openRoleDialog(
    kind: "member" | "invitation",
    person: Member | Invitation,
  ) {
    roleDialogMember = {
      kind,
      userId: person.userId,
      username: person.username ?? "Unknown",
      role: person.role,
    };
    roleDialogError = null;
    showRoleDialog = true;
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
  async function handleUpdateInvitationRole(
    userId: string,
    role: string,
  ): Promise<boolean> {
    roleDialogError = null;
    try {
      const response = await fetch(
        `/${typePrefix}/${entityId}/invitations/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        roleDialogError = body.error ?? "Failed to update role.";
        return false;
      }
      onupdate();
      return true;
    } catch {
      roleDialogError = "Network error. Please try again.";
      return false;
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
  async function handleUpdateMemberRole(
    userId: string,
    role: string,
  ): Promise<boolean> {
    roleDialogError = null;
    try {
      const response = await fetch(
        `/${typePrefix}/${entityId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        roleDialogError = body.error ?? "Failed to update role.";
        return false;
      }
      onupdate();
      return true;
    } catch {
      roleDialogError = "Network error. Please try again.";
      return false;
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

<FullscreenOverlay
  bind:open
  title="Sharing"
  onclose={close}
  footer={canManage ? doneFooter : undefined}
>
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
                        {invitation.username ?? "Unknown"}
                      </p>
                      <p class="text-xs text-slate-400 dark:text-slate-500">
                        {#if invitation.inviterUsername}
                          Invited by @{invitation.inviterUsername}<span
                            aria-hidden="true"
                            class="mx-1">·</span
                          >
                        {/if}{getRoleLabel(invitation.role)}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onclick={() => openRoleDialog("invitation", invitation)}
                      class="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-blue-400 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Edit role for invitation to {invitation.username ??
                        'user'}"
                      title="Edit role for invitation to {invitation.username ??
                        'user'}"
                    >
                      <ion-icon
                        name="pencil"
                        class="block"
                        style="font-size: 18px;"
                        aria-hidden="true"
                      ></ion-icon>
                    </button>
                    <button
                      type="button"
                      onclick={() => handleRevokeInvitation(invitation.userId)}
                      class="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Revoke invitation for {invitation.username ??
                        'user'}"
                    >
                      <ion-icon
                        name="close-outline"
                        class="block"
                        style="font-size: 18px;"
                        aria-hidden="true"
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
            {#if team}
              <div
                class="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-3"
              >
                <div
                  class="w-8 h-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                >
                  <ion-icon name="people-outline" aria-hidden="true"></ion-icon>
                </div>
                <p class="text-sm text-slate-700 dark:text-slate-300">
                  Members of
                  {#if teamLinked}
                    <a
                      href="/t/{team.id}"
                      class="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >{team.name}</a
                    >
                  {:else}
                    <span class="font-medium">{team.name}</span>
                  {/if}
                  have access via their team role
                </p>
              </div>
            {/if}
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
                      <div>
                        <p
                          class="text-sm font-medium text-slate-900 dark:text-slate-100"
                        >
                          {member.username ?? "Unknown"}
                        </p>
                        {#if canManage}
                          <p class="text-xs text-slate-400 dark:text-slate-500">
                            {getRoleLabel(member.role)}
                          </p>
                        {/if}
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      {#if canManage}
                        <button
                          type="button"
                          onclick={() => openRoleDialog("member", member)}
                          class="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-blue-400 dark:hover:bg-slate-800 transition-colors"
                          aria-label="Edit role for {member.username ?? 'user'}"
                          title="Edit role for {member.username ?? 'user'}"
                        >
                          <ion-icon
                            name="pencil"
                            class="block"
                            style="font-size: 18px;"
                            aria-hidden="true"
                          ></ion-icon>
                        </button>
                        <button
                          type="button"
                          onclick={() => handleRemoveMember(member.userId)}
                          class="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                          aria-label="Remove {member.username ?? 'user'}"
                          title="Remove {member.username ?? 'user'}"
                        >
                          <ion-icon
                            name="trash-outline"
                            class="block"
                            style="font-size: 18px;"
                            aria-hidden="true"
                          ></ion-icon>
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
            {:else if !team}
              <p class="text-sm text-slate-500 dark:text-slate-400">
                No members yet.
              </p>
            {/if}
          </section>
        {/if}

        <!-- Section 5: Leave -->
        {#if isDirectMember && !canManage}
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
</FullscreenOverlay>

{#if roleDialogMember}
  {@const target = roleDialogMember}
  <RoleDialog
    bind:open={showRoleDialog}
    title="Change role for {target.username}"
    currentRole={target.role}
    roles={roleDialogRoles}
    error={roleDialogError}
    onselect={(role) =>
      target.kind === "invitation"
        ? handleUpdateInvitationRole(target.userId, role)
        : handleUpdateMemberRole(target.userId, role)}
  />
{/if}

{#snippet doneFooter()}
  <div class="flex items-center justify-end">
    <button
      type="button"
      onclick={close}
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
    >
      Done
    </button>
  </div>
{/snippet}
