import { describe, expect, it } from "vitest";
import {
  counterRoom,
  dashboardRoom,
  FEED_PUBLIC_ROOM,
  roomForSubscription,
  SUBSCRIBABLE_ROOM_TYPES,
  teamRoom,
  userRoom,
} from "./socket-rooms";

describe("room name builders", () => {
  it("prefixes ids with the room type", () => {
    expect(counterRoom("c1")).toBe("counter:c1");
    expect(dashboardRoom("d1")).toBe("dashboard:d1");
    expect(teamRoom("t1")).toBe("team:t1");
    expect(userRoom("u1")).toBe("user:u1");
  });

  it("keeps different resource types in different rooms for the same id", () => {
    const rooms = [counterRoom("x"), dashboardRoom("x"), teamRoom("x"), userRoom("x")];
    expect(new Set(rooms).size).toBe(rooms.length);
  });
});

describe("SUBSCRIBABLE_ROOM_TYPES", () => {
  it("never lets a client subscribe to user rooms", () => {
    expect(SUBSCRIBABLE_ROOM_TYPES).not.toContain("user");
    expect([...SUBSCRIBABLE_ROOM_TYPES]).toEqual([
      "feed",
      "counter",
      "dashboard",
      "team",
    ]);
  });
});

describe("roomForSubscription", () => {
  it("maps the feed to the shared public room and ignores any id", () => {
    expect(roomForSubscription("feed")).toBe(FEED_PUBLIC_ROOM);
    expect(roomForSubscription("feed", "c1")).toBe(FEED_PUBLIC_ROOM);
  });

  it.each([
    ["counter", "counter:c1"],
    ["dashboard", "dashboard:c1"],
    ["team", "team:c1"],
  ] as const)("maps %s subscriptions to %s", (type, room) => {
    expect(roomForSubscription(type, "c1")).toBe(room);
  });

  it("falls back to an empty id instead of throwing", () => {
    expect(roomForSubscription("counter")).toBe("counter:");
  });
});
