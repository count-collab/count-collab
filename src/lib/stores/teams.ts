import { browser } from "$app/environment";
import { getSocket } from "./socket";

export type TeamMembershipChangedPayload = {
  userId: string;
  teamId: string;
  reason:
    | "joined"
    | "removed"
    | "role_changed"
    | "team_deleted"
    | "team_updated";
};

type Listener = (payload: TeamMembershipChangedPayload) => void;

const listeners = new Set<Listener>();

let registered = false;

function ensureListener(): void {
  if (registered) return;

  const socket = getSocket();
  if (!socket) return;

  registered = true;

  socket.on(
    "team:membership-changed",
    (payload: TeamMembershipChangedPayload) => {
      for (const listener of listeners) {
        listener(payload);
      }
    },
  );
}

export function onTeamMembershipChanged(listener: Listener): () => void {
  if (!browser) return () => {};

  ensureListener();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
