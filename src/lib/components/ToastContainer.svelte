<script lang="ts" module>
  import type { InvitationPayload } from "$lib/stores/invitations";

  type InvitationToastItem = {
    id: string;
    kind: "invitation";
    invitation: InvitationPayload;
  };

  type MessageToastItem = {
    id: string;
    kind: "message";
    message: string;
  };

  type ToastItem = InvitationToastItem | MessageToastItem;

  let toasts = $state<ToastItem[]>([]);
  let nextId = 0;

  export function addInvitationToast(invitation: InvitationPayload) {
    const id = String(nextId++);
    toasts = [...toasts, { id, kind: "invitation", invitation }];
  }

  export function addMessageToast(message: string) {
    const id = String(nextId++);
    toasts = [...toasts, { id, kind: "message", message }];
  }
</script>

<script lang="ts">
  import { invalidate } from "$app/navigation";
  import InvitationToast from "./InvitationToast.svelte";
  import MessageToast from "./MessageToast.svelte";

  function removeToast(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
  }

  async function handleAccept(toast: InvitationToastItem) {
    const { invitation } = toast;
    const endpoint = `/api/invitations/${invitation.type}/${invitation.entityId}`;

    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error("Failed to accept");
      await invalidate("app:invitations");
    } finally {
      removeToast(toast.id);
    }
  }

  async function handleDecline(toast: InvitationToastItem) {
    const { invitation } = toast;
    const endpoint = `/api/invitations/${invitation.type}/${invitation.entityId}`;

    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to decline");
      await invalidate("app:invitations");
    } finally {
      removeToast(toast.id);
    }
  }
</script>

<div
  class="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none max-sm:left-4 max-sm:right-4 max-sm:top-16"
>
  {#each toasts as toast (toast.id)}
    {#if toast.kind === "invitation"}
      <InvitationToast
        invitation={toast.invitation}
        onAccept={() => handleAccept(toast)}
        onDecline={() => handleDecline(toast)}
        onDismiss={() => removeToast(toast.id)}
      />
    {:else}
      <MessageToast
        message={toast.message}
        onDismiss={() => removeToast(toast.id)}
      />
    {/if}
  {/each}
</div>
