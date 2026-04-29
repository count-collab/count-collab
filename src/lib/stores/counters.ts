import { io, type Socket } from "socket.io-client";
import { browser } from "$app/environment";

export type CounterUpdatePayload = {
  counterId: string;
  count: number;
  updatedAt: string;
  cooldownSeconds?: number;
};

export type CounterCreatedPayload = {
  counterId: string;
};

type Listener<T> = (payload: T) => void;

let socket: Socket | null = null;

const updateListeners = new Set<Listener<CounterUpdatePayload>>();
const createdListeners = new Set<Listener<CounterCreatedPayload>>();

function ensureConnection(): Socket {
  if (socket) return socket;

  socket = io({ path: "/socket.io" });

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
