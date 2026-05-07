<script lang="ts">
  import type { InvitationPayload } from "$lib/stores/invitations";

  let {
    invitation,
    onAccept,
    onDecline,
    onDismiss,
  }: {
    invitation: InvitationPayload;
    onAccept: () => void;
    onDecline: () => void;
    onDismiss: () => void;
  } = $props();

  let visible = $state(false);

  $effect(() => {
    requestAnimationFrame(() => {
      visible = true;
    });

    const timer = setTimeout(() => {
      onDismiss();
    }, 10000);

    return () => clearTimeout(timer);
  });

  const roleLabel = $derived(
    invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1),
  );
</script>

<div
  class="pointer-events-auto w-full max-w-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg dark:shadow-slate-900/50 transition-all duration-300 ease-out {visible
    ? 'translate-x-0 opacity-100'
    : 'translate-x-full opacity-0'}"
  role="alert"
>
  <div class="p-4">
    <div class="flex items-start gap-3">
      <div
        class="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 {invitation.type ===
        'counter'
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
          : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}"
      >
        <ion-icon
          name={invitation.type === "counter"
            ? "trending-up-outline"
            : "grid-outline"}
          style="font-size: 18px;"
        ></ion-icon>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          New invitation
        </p>
        <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          You've been invited to
          <span class="font-medium text-slate-900 dark:text-slate-100"
            >{invitation.entityTitle}</span
          >
          as {roleLabel}
        </p>
        {#if invitation.inviterUsername}
          <p class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            by @{invitation.inviterUsername}
          </p>
        {/if}
      </div>
      <button
        type="button"
        onclick={onDismiss}
        class="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
        aria-label="Dismiss notification"
      >
        <ion-icon name="close-outline" style="font-size: 18px;"></ion-icon>
      </button>
    </div>
    <div class="flex items-center gap-2 mt-3 ml-12">
      <button
        type="button"
        onclick={onAccept}
        class="inline-flex items-center rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition"
      >
        Accept
      </button>
      <button
        type="button"
        onclick={onDecline}
        class="inline-flex items-center rounded-md border border-red-200 dark:border-red-800 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
      >
        Decline
      </button>
    </div>
  </div>
</div>
