// Socket.IO server-side emitters. Every event targets rooms (see socket-rooms.ts);
// nothing is broadcast globally. The server itself lives in $lib/server/socket-server.

import { getIO } from "$lib/utils/socket-dev";
import {
  counterRoom,
  dashboardRoom,
  FEED_PUBLIC_ROOM,
  teamRoom,
  userRoom,
} from "$lib/utils/socket-rooms";

/** Who may see a resource in list views; decides which list rooms get a refresh signal. */
export type Audience = {
  visibilityMode: string;
  ownerId?: string | null;
  teamId?: string | null;
};

function listRooms(audience: Audience | undefined): string[] {
  if (!audience) return [];

  const rooms: string[] = [];
  if (audience.visibilityMode !== "private") rooms.push(FEED_PUBLIC_ROOM);
  if (audience.teamId) rooms.push(teamRoom(audience.teamId));
  else if (audience.ownerId) rooms.push(userRoom(audience.ownerId));
  return rooms;
}

export function emitCounterUpdate(
  counterId: string,
  count: number,
  updatedAt: Date,
  username?: string | null,
  amount?: number,
  cooldownSeconds: number = 0,
  audience?: Audience,
): void {
  const io = getIO();
  if (!io) return;

  const room = counterRoom(counterId);
  io.to(room).emit("counter:updated", {
    counterId,
    count,
    amount: amount ?? 1,
    updatedAt,
    username: username ?? null,
    cooldownSeconds,
  });

  // List rooms get no incrementer details; sockets already in the counter room are skipped
  const rooms = listRooms(audience);
  if (rooms.length > 0) {
    io.to(rooms)
      .except(room)
      .emit("counter:updated", {
        counterId,
        count,
        amount: amount ?? 1,
        updatedAt,
      });
  }
}

export function emitCounterCreated(
  counterId: string,
  audience?: Audience,
): void {
  const rooms = listRooms(audience);
  if (rooms.length === 0) return;

  getIO()?.to(rooms).emit("counter:created", { counterId });
}

export function emitDashboardCreated(
  dashboardId: string,
  audience?: Audience,
): void {
  const rooms = listRooms(audience);
  if (rooms.length === 0) return;

  getIO()?.to(rooms).emit("dashboard:created", { dashboardId });
}

export function emitDashboardUpdated(
  dashboardId: string,
  audience?: Audience,
): void {
  const io = getIO();
  if (!io) return;

  const room = dashboardRoom(dashboardId);
  io.to(room).emit("dashboard:updated", { dashboardId });

  const rooms = listRooms(audience);
  if (rooms.length > 0) {
    io.to(rooms).except(room).emit("dashboard:updated", { dashboardId });
  }
}

export function emitDashboardItemAdded(
  dashboardId: string,
  itemId: number,
): void {
  getIO()
    ?.to(dashboardRoom(dashboardId))
    .emit("dashboard:item-added", { dashboardId, itemId });
}

export function emitDashboardItemRemoved(
  dashboardId: string,
  itemId: number,
): void {
  getIO()
    ?.to(dashboardRoom(dashboardId))
    .emit("dashboard:item-removed", { dashboardId, itemId });
}

export function emitInvitationCreated(
  userId: string,
  payload: {
    type: "counter" | "dashboard" | "team";
    entityId: string;
    entityTitle: string;
    role: string;
    inviterUsername: string | null;
  },
): void {
  getIO()?.to(userRoom(userId)).emit("invitation:created", { userId, ...payload });
}

export function emitInvitationUpdated(userId: string): void {
  getIO()?.to(userRoom(userId)).emit("invitation:updated", { userId });
}

export function emitInvitationDeleted(userId: string): void {
  getIO()?.to(userRoom(userId)).emit("invitation:deleted", { userId });
}

export type TeamMembershipChangeReason =
  | "joined"
  | "removed"
  | "role_changed"
  | "team_deleted"
  | "team_updated";

export function emitTeamMembershipChanged(
  userIds: string[],
  payload: { teamId: string; reason: TeamMembershipChangeReason },
): void {
  const io = getIO();
  if (!io) return;

  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;

  const event = "team:membership-changed";
  for (const userId of ids) {
    io.to(userRoom(userId)).emit(event, {
      userId,
      teamId: payload.teamId,
      reason: payload.reason,
    });
  }

  // Other team members get one notice (userId is null when several users changed)
  io.to(teamRoom(payload.teamId))
    .except(ids.map(userRoom))
    .emit(event, {
      userId: ids.length === 1 ? ids[0] : null,
      teamId: payload.teamId,
      reason: payload.reason,
    });

  if (payload.reason === "removed" || payload.reason === "team_deleted") {
    for (const userId of ids) revokeUserRooms(userId);
  }
}

/**
 * Tell sockets to drop a room and re-subscribe, e.g. after a share token rotation.
 * Clients that are still authorized rejoin; everyone else stays out.
 */
export function emitRoomRevoked(
  type: "counter" | "dashboard",
  id: string,
): void {
  const io = getIO();
  if (!io) return;

  const room = type === "counter" ? counterRoom(id) : dashboardRoom(id);
  io.to(room).emit("room:revoked", { type, id });
  io.in(room).socketsLeave(room);
}

/**
 * Make a user's sockets leave every counter/dashboard/team room and re-authorize
 * (e.g. after being removed from a team or a counter/dashboard member list).
 */
export function revokeUserRooms(userId: string): void {
  const io = getIO();
  if (!io) return;

  io.in(userRoom(userId))
    .fetchSockets()
    .then((sockets) => {
      for (const socket of sockets) {
        for (const room of [...socket.rooms]) {
          const [type, ...rest] = room.split(":");
          if (type !== "counter" && type !== "dashboard" && type !== "team") {
            continue;
          }
          socket.leave(room);
          socket.emit("room:revoked", { type, id: rest.join(":") });
        }
      }
    })
    .catch(() => {});
}
