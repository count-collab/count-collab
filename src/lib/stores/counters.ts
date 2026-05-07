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
