// Socket.IO room names shared by the server emitters and the client stores.

export const FEED_PUBLIC_ROOM = "feed:public";

/** Room types a client may ask to join; `user:` rooms are joined server-side only. */
export const SUBSCRIBABLE_ROOM_TYPES = [
  "feed",
  "counter",
  "dashboard",
  "team",
] as const;

export type SubscribableRoomType = (typeof SUBSCRIBABLE_ROOM_TYPES)[number];

export type SubscribeRequest = {
  type: SubscribableRoomType;
  id?: string;
  token?: string | null;
};

export const counterRoom = (id: string) => `counter:${id}`;
export const dashboardRoom = (id: string) => `dashboard:${id}`;
export const teamRoom = (id: string) => `team:${id}`;
export const userRoom = (id: string) => `user:${id}`;

export function roomForSubscription(
  type: SubscribableRoomType,
  id?: string,
): string {
  switch (type) {
    case "feed":
      return FEED_PUBLIC_ROOM;
    case "counter":
      return counterRoom(id ?? "");
    case "dashboard":
      return dashboardRoom(id ?? "");
    case "team":
      return teamRoom(id ?? "");
  }
}

/** Managers get the token in page data; other link holders only have it in the URL. */
export function resolveRoomToken(
  data: { shareToken?: string | null; hasValidToken?: boolean },
  href: string,
): string | null {
  if (data.shareToken) return data.shareToken;
  if (!data.hasValidToken) return null;
  return new URL(href).searchParams.get("token");
}
