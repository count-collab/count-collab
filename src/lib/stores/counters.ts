import type { Socket } from "socket.io-client";
import { browser } from "$app/environment";
import { getSocket } from "./socket";

export type CounterUpdatePayload = {
  counterId: string;
  count: number;
  updatedAt: string;
  username?: string | null;
  amount?: number;
  cooldownSeconds?: number;
};

export type CounterCreatedPayload = {
  counterId: string;
};

type Listener<T> = (payload: T) => void;

const updateListeners = new Set<Listener<CounterUpdatePayload>>();
const createdListeners = new Set<Listener<CounterCreatedPayload>>();
const statsListeners = new Set<() => void>();

let registered = false;

function ensureConnection(): Socket | null {
  const socket = getSocket();
  if (!socket) return null;

  if (!registered) {
    registered = true;

    socket.on("counter:updated", (payload: CounterUpdatePayload) => {
      for (const listener of updateListeners) {
        listener(payload);
      }
    });

    socket.on("counter:created", (payload: CounterCreatedPayload) => {
      for (const listener of createdListeners) {
        listener(payload);
      }
    });

    socket.on("stats:updated", () => {
      for (const listener of statsListeners) {
        listener();
      }
    });
  }

  return socket;
}

/**
 * Subscribe to real-time counter update events.
 * Returns an unsubscribe function. Only runs in the browser.
 */
export function onCounterUpdated(
  listener: Listener<CounterUpdatePayload>,
): () => void {
  if (!browser) return () => {};

  ensureConnection();
  updateListeners.add(listener);

  return () => {
    updateListeners.delete(listener);
  };
}

/**
 * Subscribe to global-stats changes caused by counters the viewer may not see
 * (private counters). Carries no counter data.
 */
export function onStatsUpdated(listener: () => void): () => void {
  if (!browser) return () => {};

  ensureConnection();
  statsListeners.add(listener);

  return () => {
    statsListeners.delete(listener);
  };
}

/**
 * Subscribe to real-time counter created events.
 * Returns an unsubscribe function. Only runs in the browser.
 */
export function onCounterCreated(
  listener: Listener<CounterCreatedPayload>,
): () => void {
  if (!browser) return () => {};

  ensureConnection();
  createdListeners.add(listener);

  return () => {
    createdListeners.delete(listener);
  };
}
