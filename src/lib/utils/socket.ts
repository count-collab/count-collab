// Socket.IO server-side emitters.
// The Socket.IO server instance is initialized in socket-dev.ts
// (called from vite.config.ts in dev, or from a custom server in production).

import { getIO } from "$lib/utils/socket-dev";

export function emitCounterUpdate(
  counterId: string,
  count: number,
  updatedAt: Date,
  cooldownSeconds: number = 0,
): void {
  getIO()?.emit("counter:updated", {
    counterId,
    count,
    updatedAt,
    cooldownSeconds,
  });
}

export function emitCounterCreated(counterId: string): void {
  getIO()?.emit("counter:created", { counterId });
}

export function emitDashboardCreated(dashboardId: string): void {
  getIO()?.emit("dashboard:created", { dashboardId });
}

export function emitDashboardUpdated(dashboardId: string): void {
  getIO()?.emit("dashboard:updated", { dashboardId });
}

export function emitDashboardItemAdded(
  dashboardId: string,
  itemId: number,
): void {
  getIO()?.emit("dashboard:item-added", { dashboardId, itemId });
}

export function emitDashboardItemRemoved(
  dashboardId: string,
  itemId: number,
): void {
  getIO()?.emit("dashboard:item-removed", { dashboardId, itemId });
}
