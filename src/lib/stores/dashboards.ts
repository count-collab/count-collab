import { io, type Socket } from "socket.io-client";
import { browser } from "$app/environment";

export type DashboardCreatedPayload = {
  dashboardId: string;
};

export type DashboardUpdatedPayload = {
  dashboardId: string;
};

export type DashboardItemAddedPayload = {
  dashboardId: string;
  itemId: number;
};

export type DashboardItemRemovedPayload = {
  dashboardId: string;
  itemId: number;
};

type Listener<T> = (payload: T) => void;

let socket: Socket | null = null;

const createdListeners = new Set<Listener<DashboardCreatedPayload>>();
const updatedListeners = new Set<Listener<DashboardUpdatedPayload>>();
const itemAddedListeners = new Set<Listener<DashboardItemAddedPayload>>();
const itemRemovedListeners = new Set<Listener<DashboardItemRemovedPayload>>();

function ensureConnection(): Socket {
  if (socket) return socket;

  socket = io({ path: "/socket.io" });

  socket.on("dashboard:created", (payload: DashboardCreatedPayload) => {
    for (const listener of createdListeners) {
      listener(payload);
    }
  });

  socket.on("dashboard:updated", (payload: DashboardUpdatedPayload) => {
    for (const listener of updatedListeners) {
      listener(payload);
    }
  });

  socket.on("dashboard:item-added", (payload: DashboardItemAddedPayload) => {
    for (const listener of itemAddedListeners) {
      listener(payload);
    }
  });

  socket.on(
    "dashboard:item-removed",
    (payload: DashboardItemRemovedPayload) => {
      for (const listener of itemRemovedListeners) {
        listener(payload);
      }
    },
  );

  return socket;
}

export function onDashboardCreated(
  listener: Listener<DashboardCreatedPayload>,
): () => void {
  if (!browser) return () => {};
  ensureConnection();
  createdListeners.add(listener);
  return () => {
    createdListeners.delete(listener);
  };
}

export function onDashboardUpdated(
  listener: Listener<DashboardUpdatedPayload>,
): () => void {
  if (!browser) return () => {};
  ensureConnection();
  updatedListeners.add(listener);
  return () => {
    updatedListeners.delete(listener);
  };
}

export function onDashboardItemAdded(
  listener: Listener<DashboardItemAddedPayload>,
): () => void {
  if (!browser) return () => {};
  ensureConnection();
  itemAddedListeners.add(listener);
  return () => {
    itemAddedListeners.delete(listener);
  };
}

export function onDashboardItemRemoved(
  listener: Listener<DashboardItemRemovedPayload>,
): () => void {
  if (!browser) return () => {};
  ensureConnection();
  itemRemovedListeners.add(listener);
  return () => {
    itemRemovedListeners.delete(listener);
  };
}
