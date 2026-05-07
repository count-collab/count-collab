<script lang="ts">
  
  import posthog from "posthog-js";
import { invalidate, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import {
    type InvitationPayload,
    onInvitationCreated,
    onInvitationDeleted,
    onInvitationUpdated,
  } from "$lib/stores/invitations";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const userId = $derived($page.data.session?.user?.id);

  function handleSocketEvent(payload: InvitationPayload) {
    if (payload.userId === userId) {
      invalidate("app:invitations");
    }
  }

  $effect(() => {
    const unsubs = [
      onInvitationCreated(handleSocketEvent),
      onInvitationUpdated(handleSocketEvent),
      onInvitationDeleted(handleSocketEvent),
    ];
    return () => {
      for (const fn of unsubs) fn();
    };
  });

  let loadingIds = $state(new Set<string>());

  function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  async function accept(invitation: (typeof data.invitations)[0]) {
    const id = invitation.id.toString();
    loadingIds.add(id);
    loadingIds = new Set(loadingIds);

    try {
      const endpoint =
        invitation.type === "counter"
          ? `/api/invitations/counter/${invitation.resourceId}`
          : `/api/invitations/dashboard/${invitation.resourceId}`;

      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error("Failed to accept invitation");

      posthog.capture("invitation_accepted", {
        resource_type: invitation.type,
        resource_id: invitation.resourceId,
        role: invitation.role,
      });
      await invalidateAll();
    } finally {
      loadingIds.delete(id);
      loadingIds = new Set(loadingIds);
    }
  }

  async function decline(invitation: (typeof data.invitations)[0]) {
    const id = invitation.id.toString();
    loadingIds.add(id);
    loadingIds = new Set(loadingIds);

    try {
      const endpoint =
        invitation.type === "counter"
          ? `/api/invitations/counter/${invitation.resourceId}`
          : `/api/invitations/dashboard/${invitation.resourceId}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to decline invitation");

      posthog.capture("invitation_declined", {
        resource_type: invitation.type,
        resource_id: invitation.resourceId,
        role: invitation.role,
      });
      await invalidateAll();
    } finally {
      loadingIds.delete(id);
      loadingIds = new Set(loadingIds);
    }
  }
</script>

<MetaTags
  title="Invitations | Count Collab"
  description="View and manage your pending invitations."
  path="/invitations"
/>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
    Invitations
  </h1>

  {#if data.invitations.length === 0}
    <div
      class="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-12 text-center"
    >
      <ion-icon
        name="notifications-outline"
        style="font-size: 48px;"
        class="text-slate-300 dark:text-slate-600"
      ></ion-icon>
      <p class="mt-4 text-slate-500 dark:text-slate-400 text-lg">
        No pending invitations
      </p>
      <p class="mt-1 text-slate-400 dark:text-slate-500 text-sm">
        When someone invites you to a counter or dashboard, it will appear here.
      </p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each data.invitations as invitation (invitation.id)}
        {@const isLoading = loadingIds.has(invitation.id.toString())}
        <div
          class="flex flex-col sm:flex-row sm:items-center gap-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition hover:shadow-md"
        >
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <div
              class="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 {invitation.type ===
              'counter'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}"
            >
              <ion-icon
                name={invitation.type === "counter"
                  ? "trending-up-outline"
                  : "grid-outline"}
                style="font-size: 20px;"
              ></ion-icon>
            </div>
            <div class="min-w-0 flex-1">
              <p
                class="font-semibold text-slate-900 dark:text-slate-100 truncate"
              >
                {invitation.title}
              </p>
              <div
                class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-slate-500 dark:text-slate-400"
              >
                {#if invitation.inviterUsername}
                  <span>Invited by @{invitation.inviterUsername}</span>
                  <span class="text-slate-300 dark:text-slate-600">·</span>
                {/if}
                <span
                  class="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  as {invitation.role.charAt(0).toUpperCase() +
                    invitation.role.slice(1)}
                </span>
                <span class="text-slate-300 dark:text-slate-600">·</span>
                <span>{timeAgo(invitation.createdAt.toString())}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0 sm:ml-auto">
            <button
              type="button"
              disabled={isLoading}
              onclick={() => accept(invitation)}
              class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ion-icon name="checkmark-outline" style="font-size: 16px;"
              ></ion-icon>
              Accept
            </button>
            <button
              type="button"
              disabled={isLoading}
              onclick={() => decline(invitation)}
              class="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 px-4 py-1.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ion-icon name="close-outline" style="font-size: 16px;"
              ></ion-icon>
              Decline
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
