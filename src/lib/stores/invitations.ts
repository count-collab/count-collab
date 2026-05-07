import { browser } from "$app/environment";
import { getSocket } from "./socket";

export type InvitationPayload = {
  userId: string;
  type: "counter" | "dashboard";
  entityId: string;
  entityTitle: string;
  role: string;
  inviterUsername: string | null;
};

type Listener<T> = (payload: T) => void;

const createdListeners = new Set<Listener<InvitationPayload>>();
const updatedListeners = new Set<Listener<InvitationPayload>>();
const deletedListeners = new Set<Listener<InvitationPayload>>();

let registered = false;

function ensureListeners(): void {
  if (registered) return;

  const socket = getSocket();
  if (!socket) return;

  registered = true;

  socket.on("invitation:created", (payload: InvitationPayload) => {
    for (const listener of createdListeners) {
      listener(payload);
    }
  });

  socket.on("invitation:updated", (payload: InvitationPayload) => {
    for (const listener of updatedListeners) {
      listener(payload);
    }
  });

  socket.on("invitation:deleted", (payload: InvitationPayload) => {
    for (const listener of deletedListeners) {
      listener(payload);
    }
  });
}

export function onInvitationCreated(
  listener: Listener<InvitationPayload>,
): () => void {
  if (!browser) return () => {};

  ensureListeners();
  createdListeners.add(listener);

  return () => {
    createdListeners.delete(listener);
  };
}

export function onInvitationUpdated(
  listener: Listener<InvitationPayload>,
): () => void {
  if (!browser) return () => {};

  ensureListeners();
  updatedListeners.add(listener);

  return () => {
    updatedListeners.delete(listener);
  };
}

export function onInvitationDeleted(
  listener: Listener<InvitationPayload>,
): () => void {
  if (!browser) return () => {};

  ensureListeners();
  deletedListeners.add(listener);

  return () => {
    deletedListeners.delete(listener);
  };
}
