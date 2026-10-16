import { io, type Socket } from "socket.io-client";
import { browser } from "$app/environment";
import {
  roomForSubscription,
  type SubscribableRoomType,
  type SubscribeRequest,
} from "$lib/utils/socket-rooms";

// Delays leaving so quick unsubscribe/resubscribe cycles (navigation, effect reruns) cost nothing
const LEAVE_DELAY_MS = 2000;

type Subscription = {
  request: SubscribeRequest;
  refs: number;
  leaveTimer: ReturnType<typeof setTimeout> | null;
};

const subscriptions = new Map<string, Subscription>();

let socket: Socket | null = null;

function sendSubscribe(request: SubscribeRequest): void {
  if (!socket?.connected) return;

  const payload: SubscribeRequest = { type: request.type };
  if (request.id) payload.id = request.id;
  if (request.token) payload.token = request.token;
  socket.emit("subscribe", payload);
}

function sendUnsubscribe(request: SubscribeRequest): void {
  if (!socket?.connected) return;

  socket.emit(
    "unsubscribe",
    request.id ? { type: request.type, id: request.id } : { type: request.type },
  );
}

export function getSocket(): Socket | null {
  if (!browser) return null;

  if (socket) return socket;

  socket = io({ path: "/socket.io" });

  // Rooms are lost on disconnect, so rejoin everything after each (re)connect
  socket.on("connect", () => {
    for (const { request } of subscriptions.values()) sendSubscribe(request);
  });

  // Server dropped a room (token rotated, membership changed); try again to re-authorize
  socket.on("room:revoked", (payload: { type?: string; id?: string }) => {
    const key = `${payload?.type}:${payload?.id}`;
    const subscription = subscriptions.get(key);
    if (subscription) sendSubscribe(subscription.request);
  });

  return socket;
}

/**
 * Join a realtime room until the returned function is called. Calls are
 * reference counted per room; `token` is the share token for private resources.
 * The server only admits the socket if it may view the resource.
 */
export function subscribeRoom(
  type: SubscribableRoomType,
  id?: string,
  token?: string | null,
): () => void {
  if (!getSocket()) return () => {};

  const key = roomForSubscription(type, id);
  let subscription = subscriptions.get(key);

  if (subscription) {
    if (subscription.leaveTimer) clearTimeout(subscription.leaveTimer);
    subscription.leaveTimer = null;
    subscription.refs += 1;
    if (token && token !== subscription.request.token) {
      subscription.request = { type, id, token };
      sendSubscribe(subscription.request);
    }
  } else {
    subscription = { request: { type, id, token }, refs: 1, leaveTimer: null };
    subscriptions.set(key, subscription);
    sendSubscribe(subscription.request);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const current = subscriptions.get(key);
    if (!current) return;
    current.refs -= 1;
    if (current.refs > 0) return;

    current.leaveTimer = setTimeout(() => {
      subscriptions.delete(key);
      sendUnsubscribe(current.request);
    }, LEAVE_DELAY_MS);
  };
}
