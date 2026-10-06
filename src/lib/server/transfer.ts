import { and, eq, inArray } from "drizzle-orm";
import { db } from "$lib/db";
import {
  counters,
  dashboardItems,
  dashboards,
  teamMembers,
  teams,
} from "$lib/db/schema";
import { isTeamRoleAtLeast } from "$lib/roles";
import { logEventInTx } from "$lib/server/events";
import { logger } from "$lib/server/logger";
import { getActingTeamRole } from "$lib/server/team-authorize";

export type TransferFailure = {
  ok: false;
  status: 400 | 403 | 404;
  message: string;
};

export type TransferResult = { ok: true } | TransferFailure;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Ownership = { ownerId: string | null; teamId: string | null };

function fail(status: TransferFailure["status"], message: string) {
  return { ok: false, status, message } as const;
}

/**
 * Apply the transfer permission matrix for one resource.
 * Personal source: actor must be the owner. Team source: admin+. Team target: editor+.
 */
async function checkTransfer(
  actorUserId: string,
  resource: Ownership,
  targetTeamId: string | null,
  getRole: typeof getActingTeamRole,
): Promise<TransferResult> {
  if (resource.teamId === targetTeamId) {
    return fail(
      400,
      targetTeamId ? "Already in this team" : "Already a personal resource",
    );
  }

  if (resource.teamId === null) {
    if (resource.ownerId !== actorUserId) {
      return fail(403, "Only the owner can transfer a personal resource");
    }
  } else {
    const sourceRole = await getRole(actorUserId, resource.teamId);
    if (!isTeamRoleAtLeast(sourceRole, "admin")) {
      return fail(403, "Admin role required in the source team");
    }
  }

  if (targetTeamId !== null) {
    const targetRole = await getRole(actorUserId, targetTeamId);
    // Non-members get the same 404 as for a missing team
    if (!targetRole) return fail(404, "Team not found");
    if (!isTeamRoleAtLeast(targetRole, "editor")) {
      return fail(403, "Editor role required in the target team");
    }
  }

  return { ok: true };
}

function memoizedRoleLookup(): typeof getActingTeamRole {
  const cache = new Map<string, ReturnType<typeof getActingTeamRole>>();
  return (userId, teamId) => {
    const key = `${userId}:${teamId}`;
    let role = cache.get(key);
    if (!role) {
      role = getActingTeamRole(userId, teamId);
      cache.set(key, role);
    }
    return role;
  };
}

async function teamExists(tx: Tx, teamId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: teams.id })
    .from(teams)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(teams.id, teamId as any))
    // Serializes with deleteTeam's FOR UPDATE so a team can't vanish mid-transfer
    .for("share");
  return !!row;
}

/**
 * Share-lock the actor's memberships so a concurrent demotion or removal can't commit mid-transfer.
 */
async function lockActorMemberships(
  tx: Tx,
  actorUserId: string,
  teamIds: (string | null)[],
): Promise<void> {
  const ids = [...new Set(teamIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return;

  await tx
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, actorUserId),
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        inArray(teamMembers.teamId, ids as any),
      ),
    )
    .for("share");
}

function ownershipUpdate(actorUserId: string, targetTeamId: string | null) {
  return {
    teamId: targetTeamId,
    updatedAt: new Date(),
    ...(targetTeamId === null ? { ownerId: actorUserId } : {}),
  };
}

export async function transferCounter(
  actorUserId: string,
  counterId: string,
  targetTeamId: string | null,
): Promise<TransferResult> {
  const result = await db.transaction(async (tx): Promise<TransferResult> => {
    const [counter] = await tx
      .select({ ownerId: counters.ownerId, teamId: counters.teamId })
      .from(counters)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(counters.id, counterId as any))
      .for("update");

    if (!counter) return fail(404, "Counter not found");

    if (targetTeamId && !(await teamExists(tx, targetTeamId))) {
      return fail(404, "Team not found");
    }

    await lockActorMemberships(tx, actorUserId, [counter.teamId, targetTeamId]);

    const check = await checkTransfer(
      actorUserId,
      counter,
      targetTeamId,
      getActingTeamRole,
    );
    if (!check.ok) return check;

    await tx
      .update(counters)
      .set(ownershipUpdate(actorUserId, targetTeamId))
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(counters.id, counterId as any));

    await logEventInTx(tx, {
      eventType: "resource_transferred",
      userId: actorUserId,
      entityId: counterId,
      entityType: "counter",
      metadata: {
        resourceType: "counter",
        fromTeamId: counter.teamId,
        toTeamId: targetTeamId,
      },
    });

    return { ok: true };
  });

  if (result.ok) {
    logger.info("Counter transferred", { counterId, targetTeamId });
  }

  return result;
}

/**
 * Transfer a dashboard and, atomically, any of its counters listed in alsoMoveCounterIds.
 */
export async function transferDashboard(
  actorUserId: string,
  dashboardId: string,
  targetTeamId: string | null,
  alsoMoveCounterIds: string[],
): Promise<TransferResult> {
  const counterIds = [...new Set(alsoMoveCounterIds)];
  const getRole = memoizedRoleLookup();

  const result = await db.transaction(async (tx): Promise<TransferResult> => {
    const [dashboard] = await tx
      .select({ ownerId: dashboards.ownerId, teamId: dashboards.teamId })
      .from(dashboards)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(dashboards.id, dashboardId as any))
      .for("update");

    if (!dashboard) return fail(404, "Dashboard not found");

    if (targetTeamId && !(await teamExists(tx, targetTeamId))) {
      return fail(404, "Team not found");
    }

    await lockActorMemberships(tx, actorUserId, [
      dashboard.teamId,
      targetTeamId,
    ]);

    const check = await checkTransfer(
      actorUserId,
      dashboard,
      targetTeamId,
      getRole,
    );
    if (!check.ok) return check;

    const movedCounters: { id: string; teamId: string | null }[] = [];

    if (counterIds.length > 0) {
      const counterRows = await tx
        .select({
          id: counters.id,
          title: counters.title,
          ownerId: counters.ownerId,
          teamId: counters.teamId,
        })
        .from(counters)
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        .where(inArray(counters.id, counterIds as any))
        .for("update");

      const itemRows = await tx
        .select({ counterId: dashboardItems.counterId })
        .from(dashboardItems)
        .where(
          and(
            // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
            eq(dashboardItems.dashboardId, dashboardId as any),
            // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
            inArray(dashboardItems.counterId, counterIds as any),
          ),
        );

      const onDashboard = new Set(itemRows.map((r) => r.counterId));
      const byId = new Map(counterRows.map((c) => [c.id, c]));

      await lockActorMemberships(
        tx,
        actorUserId,
        counterRows.map((c) => c.teamId),
      );

      for (const id of counterIds) {
        const counter = byId.get(id);
        if (!counter || !onDashboard.has(id)) {
          // Don't echo the title: the actor may have no access to arbitrary counters
          return fail(400, `Counter ${id} is not on this dashboard`);
        }

        const counterCheck = await checkTransfer(
          actorUserId,
          counter,
          targetTeamId,
          getRole,
        );
        if (!counterCheck.ok) {
          return fail(
            counterCheck.status,
            `Cannot move counter "${counter.title}": ${counterCheck.message}`,
          );
        }

        movedCounters.push({ id, teamId: counter.teamId });
      }
    }

    await tx
      .update(dashboards)
      .set(ownershipUpdate(actorUserId, targetTeamId))
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(dashboards.id, dashboardId as any));

    await logEventInTx(tx, {
      eventType: "resource_transferred",
      userId: actorUserId,
      entityId: dashboardId,
      entityType: "dashboard",
      metadata: {
        resourceType: "dashboard",
        fromTeamId: dashboard.teamId,
        toTeamId: targetTeamId,
      },
    });

    if (movedCounters.length > 0) {
      await tx
        .update(counters)
        .set(ownershipUpdate(actorUserId, targetTeamId))
        .where(
          inArray(
            counters.id,
            // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
            movedCounters.map((c) => c.id) as any,
          ),
        );

      for (const counter of movedCounters) {
        await logEventInTx(tx, {
          eventType: "resource_transferred",
          userId: actorUserId,
          entityId: counter.id,
          entityType: "counter",
          metadata: {
            resourceType: "counter",
            fromTeamId: counter.teamId,
            toTeamId: targetTeamId,
          },
        });
      }
    }

    return { ok: true };
  });

  if (result.ok) {
    logger.info("Dashboard transferred", {
      dashboardId,
      targetTeamId,
      counters: counterIds.length,
    });
  }

  return result;
}
