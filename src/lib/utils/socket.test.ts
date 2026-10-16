import { beforeEach, describe, expect, it, vi } from "vitest";

type Emission = {
  rooms: string[];
  except: string[];
  event: string;
  payload: unknown;
};

const { mockGetIO, emissions, socketsLeave, fetchSockets } = vi.hoisted(() => ({
  mockGetIO: vi.fn(),
  emissions: [] as Emission[],
  socketsLeave: vi.fn(),
  fetchSockets: vi.fn(),
}));

function fakeIO() {
  const toRooms = (rooms: string | string[], except: string[] = []) => ({
    except: (excluded: string | string[]) =>
      toRooms(rooms, [...except, ...[excluded].flat()]),
    emit: (event: string, payload: unknown) => {
      emissions.push({ rooms: [rooms].flat(), except, event, payload });
    },
  });

  return {
    to: (rooms: string | string[]) => toRooms(rooms),
    in: (room: string) => ({
      socketsLeave: (target: string) => socketsLeave(room, target),
      fetchSockets: () => fetchSockets(room),
    }),
    // A global broadcast would land here; nothing may call it
    emit: vi.fn(),
  };
}

vi.mock("$lib/utils/socket-dev", () => ({ getIO: mockGetIO }));

import {
  emitCounterCreated,
  emitCounterUpdate,
  emitDashboardCreated,
  emitDashboardItemAdded,
  emitDashboardItemRemoved,
  emitDashboardUpdated,
  emitInvitationCreated,
  emitInvitationDeleted,
  emitInvitationUpdated,
  emitRoomRevoked,
  emitTeamMembershipChanged,
  revokeUserRooms,
} from "./socket";

let io: ReturnType<typeof fakeIO>;
const updatedAt = new Date("2026-01-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  emissions.length = 0;
  io = fakeIO();
  mockGetIO.mockReturnValue(io);
});

describe("emitCounterUpdate", () => {
  it("sends full details to the counter room and a bare stats ping to the feed for private counters", () => {
    emitCounterUpdate("c1", 5, updatedAt, "alice", 2, 10, {
      visibilityMode: "private",
      ownerId: null,
      teamId: null,
    });

    expect(emissions).toEqual([
      {
        rooms: ["counter:c1"],
        except: [],
        event: "counter:updated",
        payload: {
          counterId: "c1",
          count: 5,
          amount: 2,
          updatedAt,
          username: "alice",
          cooldownSeconds: 10,
        },
      },
      {
        rooms: ["feed:public"],
        except: [],
        event: "stats:updated",
        payload: undefined,
      },
    ]);
  });

  it("does not send stats:updated for public counters", () => {
    emitCounterUpdate("c1", 5, updatedAt, "alice", 1, 0, {
      visibilityMode: "public",
      ownerId: null,
      teamId: null,
    });

    expect(emissions.map((e) => e.event)).not.toContain("stats:updated");
  });

  it("adds a username-free list notice to the owner room for private counters", () => {
    emitCounterUpdate("c1", 5, updatedAt, "alice", 1, 0, {
      visibilityMode: "private",
      ownerId: "owner-1",
      teamId: null,
    });

    expect(emissions).toHaveLength(3);
    expect(emissions[1]).toEqual({
      rooms: ["user:owner-1"],
      except: ["counter:c1"],
      event: "counter:updated",
      payload: { counterId: "c1", count: 5, amount: 1, updatedAt },
    });
    expect(emissions[1].payload).not.toHaveProperty("username");
  });

  it("targets the team room instead of the owner for team counters", () => {
    emitCounterUpdate("c1", 5, updatedAt, "alice", 1, 0, {
      visibilityMode: "private",
      ownerId: "owner-1",
      teamId: "team-1",
    });

    expect(emissions[1].rooms).toEqual(["team:team-1"]);
  });

  it("includes feed:public only for public counters, without the username", () => {
    emitCounterUpdate("c1", 5, updatedAt, "alice", 1, 0, {
      visibilityMode: "public",
      ownerId: "owner-1",
      teamId: null,
    });

    expect(emissions[1].rooms).toEqual(["feed:public", "user:owner-1"]);
    expect(emissions[1].except).toEqual(["counter:c1"]);
    expect(emissions[1].payload).not.toHaveProperty("username");
    expect(emissions[1].payload).not.toHaveProperty("cooldownSeconds");
  });

  it("treats public_readonly as public for the feed", () => {
    emitCounterUpdate("c1", 5, updatedAt, null, 1, 0, {
      visibilityMode: "public_readonly",
    });

    expect(emissions[1].rooms).toEqual(["feed:public"]);
  });

  it("emits only to the counter room when no audience is given", () => {
    emitCounterUpdate("c1", 5, updatedAt, null);

    expect(emissions).toHaveLength(1);
    expect(emissions[0].rooms).toEqual(["counter:c1"]);
    expect(emissions[0].payload).toMatchObject({
      username: null,
      amount: 1,
      cooldownSeconds: 0,
    });
  });
});

describe("list events", () => {
  it("never announces private counter creation to the feed", () => {
    emitCounterCreated("c1", {
      visibilityMode: "private",
      ownerId: "owner-1",
    });

    expect(emissions).toEqual([
      {
        rooms: ["user:owner-1"],
        except: [],
        event: "counter:created",
        payload: { counterId: "c1" },
      },
    ]);
  });

  it("announces public counter creation to the feed and owner", () => {
    emitCounterCreated("c1", { visibilityMode: "public", ownerId: "owner-1" });

    expect(emissions[0].rooms).toEqual(["feed:public", "user:owner-1"]);
  });

  it("emits nothing for creation without an audience", () => {
    emitCounterCreated("c1");
    emitDashboardCreated("d1", { visibilityMode: "private" });

    expect(emissions).toEqual([]);
  });

  it("announces dashboard creation to the matching list rooms", () => {
    emitDashboardCreated("d1", {
      visibilityMode: "public",
      ownerId: "owner-1",
      teamId: "team-1",
    });

    expect(emissions).toEqual([
      {
        rooms: ["feed:public", "team:team-1"],
        except: [],
        event: "dashboard:created",
        payload: { dashboardId: "d1" },
      },
    ]);
  });
});

describe("dashboard events", () => {
  it("sends updates to the dashboard room and skips it for the list notice", () => {
    emitDashboardUpdated("d1", { visibilityMode: "public", ownerId: "o1" });

    expect(emissions).toEqual([
      {
        rooms: ["dashboard:d1"],
        except: [],
        event: "dashboard:updated",
        payload: { dashboardId: "d1" },
      },
      {
        rooms: ["feed:public", "user:o1"],
        except: ["dashboard:d1"],
        event: "dashboard:updated",
        payload: { dashboardId: "d1" },
      },
    ]);
  });

  it("keeps private dashboard updates out of the feed", () => {
    emitDashboardUpdated("d1", { visibilityMode: "private" });

    expect(emissions.map((e) => e.rooms)).toEqual([["dashboard:d1"]]);
  });

  it("sends item events to the dashboard room only", () => {
    emitDashboardItemAdded("d1", 7);
    emitDashboardItemRemoved("d1", 7);

    expect(emissions).toEqual([
      {
        rooms: ["dashboard:d1"],
        except: [],
        event: "dashboard:item-added",
        payload: { dashboardId: "d1", itemId: 7 },
      },
      {
        rooms: ["dashboard:d1"],
        except: [],
        event: "dashboard:item-removed",
        payload: { dashboardId: "d1", itemId: 7 },
      },
    ]);
  });
});

describe("invitation events", () => {
  it("target only the recipient's user room", () => {
    emitInvitationCreated("u1", {
      type: "team",
      entityId: "t1",
      entityTitle: "Team",
      role: "editor",
      inviterUsername: "bob",
    });
    emitInvitationUpdated("u1");
    emitInvitationDeleted("u1");

    expect(emissions.map((e) => [e.rooms, e.event])).toEqual([
      [["user:u1"], "invitation:created"],
      [["user:u1"], "invitation:updated"],
      [["user:u1"], "invitation:deleted"],
    ]);
    expect(emissions[0].payload).toEqual({
      userId: "u1",
      type: "team",
      entityId: "t1",
      entityTitle: "Team",
      role: "editor",
      inviterUsername: "bob",
    });
  });
});

describe("emitTeamMembershipChanged", () => {
  it("emits one event per affected user room with only userId, teamId and reason", () => {
    emitTeamMembershipChanged(["user-1", "user-2"], {
      teamId: "team-1",
      reason: "role_changed",
    });

    expect(emissions[0]).toEqual({
      rooms: ["user:user-1"],
      except: [],
      event: "team:membership-changed",
      payload: { userId: "user-1", teamId: "team-1", reason: "role_changed" },
    });
    expect(emissions[1].rooms).toEqual(["user:user-2"]);
  });

  it("notifies the team room excluding the affected users", () => {
    emitTeamMembershipChanged(["user-1"], {
      teamId: "team-1",
      reason: "role_changed",
    });

    expect(emissions[1]).toEqual({
      rooms: ["team:team-1"],
      except: ["user:user-1"],
      event: "team:membership-changed",
      payload: { userId: "user-1", teamId: "team-1", reason: "role_changed" },
    });
  });

  it("hides the user id from the team room when several users changed", () => {
    emitTeamMembershipChanged(["user-1", "user-2"], {
      teamId: "team-1",
      reason: "team_updated",
    });

    const teamNotice = emissions.at(-1);
    expect(teamNotice?.rooms).toEqual(["team:team-1"]);
    expect(teamNotice?.except).toEqual(["user:user-1", "user:user-2"]);
    expect(teamNotice?.payload).toMatchObject({ userId: null });
  });

  it("deduplicates user ids", () => {
    emitTeamMembershipChanged(["user-1", "user-1"], {
      teamId: "team-1",
      reason: "role_changed",
    });

    expect(emissions.filter((e) => e.rooms[0] === "user:user-1")).toHaveLength(
      1,
    );
  });

  it("strips extra payload fields", () => {
    emitTeamMembershipChanged(["user-1"], {
      teamId: "team-1",
      reason: "joined",
      joinToken: "secret",
    } as never);

    for (const emission of emissions) {
      expect(emission.payload).not.toHaveProperty("joinToken");
    }
  });

  it("does nothing for an empty user list", () => {
    emitTeamMembershipChanged([], { teamId: "team-1", reason: "team_updated" });

    expect(emissions).toEqual([]);
  });

  it("is a no-op when Socket.IO is not initialized", () => {
    mockGetIO.mockReturnValue(null);

    expect(() =>
      emitTeamMembershipChanged(["user-1"], {
        teamId: "team-1",
        reason: "removed",
      }),
    ).not.toThrow();
  });

  it("revokes the removed user's rooms", async () => {
    const leave = vi.fn();
    const sent: unknown[] = [];
    fetchSockets.mockResolvedValue([
      {
        rooms: new Set(["sid", "user:user-1", "team:team-1", "feed:public"]),
        leave,
        emit: (...args: unknown[]) => sent.push(args),
      },
    ]);

    emitTeamMembershipChanged(["user-1"], {
      teamId: "team-1",
      reason: "removed",
    });
    await vi.waitFor(() => expect(leave).toHaveBeenCalled());

    expect(fetchSockets).toHaveBeenCalledWith("user:user-1");
    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith("team:team-1");
    expect(sent).toEqual([["room:revoked", { type: "team", id: "team-1" }]]);
  });
});

describe("room revocation", () => {
  it("tells subscribers to re-authorize, then removes them from the room", () => {
    emitRoomRevoked("counter", "c1");

    expect(emissions).toEqual([
      {
        rooms: ["counter:c1"],
        except: [],
        event: "room:revoked",
        payload: { type: "counter", id: "c1" },
      },
    ]);
    expect(socketsLeave).toHaveBeenCalledWith("counter:c1", "counter:c1");
  });

  it("supports dashboards", () => {
    emitRoomRevoked("dashboard", "d1");

    expect(socketsLeave).toHaveBeenCalledWith("dashboard:d1", "dashboard:d1");
  });

  it("does not touch user or feed rooms when revoking a user", async () => {
    const leave = vi.fn();
    fetchSockets.mockResolvedValue([
      {
        rooms: new Set(["sid", "user:u1", "feed:public", "counter:c1"]),
        leave,
        emit: vi.fn(),
      },
    ]);

    revokeUserRooms("u1");
    await vi.waitFor(() => expect(leave).toHaveBeenCalled());

    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith("counter:c1");
  });
});

describe("no global broadcast", () => {
  it("never calls io.emit", () => {
    emitCounterUpdate("c1", 1, updatedAt, "a", 1, 0, {
      visibilityMode: "public",
      ownerId: "o",
    });
    emitCounterCreated("c1", { visibilityMode: "public" });
    emitDashboardCreated("d1", { visibilityMode: "public" });
    emitDashboardUpdated("d1", { visibilityMode: "public" });
    emitDashboardItemAdded("d1", 1);
    emitDashboardItemRemoved("d1", 1);
    emitInvitationCreated("u", {
      type: "counter",
      entityId: "c",
      entityTitle: "t",
      role: "viewer",
      inviterUsername: null,
    });
    emitInvitationUpdated("u");
    emitInvitationDeleted("u");
    emitTeamMembershipChanged(["u"], { teamId: "t", reason: "joined" });
    emitRoomRevoked("counter", "c1");

    expect(io.emit).not.toHaveBeenCalled();
  });
});
