import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/db";
import { users } from "$lib/db/schema";
import { isTeamRoleAtLeast } from "$lib/roles";
import {
  canIncrementCounter,
  canIncrementPrivateCounter,
  canViewPrivateCounter,
} from "$lib/server/authorize";
import { getCounter } from "$lib/server/counters";
import {
  canDeleteDashboard,
  canEditDashboard,
  canManageDashboardMembers,
  canViewDashboard,
  getDashboardAccess,
} from "$lib/server/dashboard-authorize";
import { getDashboardInvitations } from "$lib/server/dashboard-invitations";
import { getDashboardItems } from "$lib/server/dashboard-items";
import { getDashboardMembers } from "$lib/server/dashboard-members";
import { getDashboard } from "$lib/server/dashboards";
import {
  getDashboardFollowerCount,
  isFollowingDashboard,
} from "$lib/server/followers";
import { logger } from "$lib/server/logger";
import { getActingTeamRole } from "$lib/server/team-authorize";
import { getTeam, listEditableTeams } from "$lib/server/teams";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({
  params,
  depends,
  locals,
  url,
}) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);

  if (!idValidation.success) {
    logger.warn("Invalid dashboard ID format", { id: params.id });
    throw error(400, "Invalid dashboard ID format");
  }

  const dashboard = await getDashboard(params.id);

  if (!dashboard) {
    logger.warn("Dashboard not found", { id: params.id });
    throw error(404, "Dashboard not found");
  }

  const session = await locals.auth();
  const userId = session?.user?.id;
  const isPrivate = dashboard.visibilityMode === "private";

  const token = url.searchParams.get("token");
  const hasValidToken =
    isPrivate &&
    !!token &&
    !!dashboard.shareToken &&
    token === dashboard.shareToken;

  if (isPrivate && !hasValidToken) {
    if (userId) {
      const canView = await canViewDashboard(userId, dashboard.id);
      if (!canView) {
        throw error(403, "You don't have access to this dashboard");
      }
    } else {
      throw error(403, "Sign in to view this private dashboard");
    }
  }

  const rawItems = await getDashboardItems(params.id);

  const items = await Promise.all(
    rawItems.map(async (item) => {
      const counter = await getCounter(item.counterId);

      if (!counter) {
        return { item, counter: null, canIncrement: false };
      }

      if (counter.visibilityMode === "private") {
        const canView = userId
          ? await canViewPrivateCounter(userId, counter.id)
          : false;
        if (!canView) {
          return { item, counter: null, canIncrement: false };
        }
      }

      let canIncrement = false;
      if (counter.visibilityMode === "public") {
        canIncrement = true;
      } else if (counter.visibilityMode === "private") {
        canIncrement = userId
          ? (await canIncrementPrivateCounter(userId, counter.id)) === "allowed"
          : false;
      } else {
        canIncrement = userId
          ? await canIncrementCounter(userId, counter.id)
          : false;
      }

      return { item, counter, canIncrement };
    }),
  );

  const canEdit = userId ? await canEditDashboard(userId, dashboard.id) : false;
  const canDelete = userId
    ? await canDeleteDashboard(userId, dashboard.id)
    : false;
  const canManage = userId
    ? await canManageDashboardMembers(userId, dashboard.id)
    : false;
  const access = userId ? await getDashboardAccess(userId, dashboard.id) : null;
  const isOwner = access?.isOwner ?? false;
  const memberRole = access?.effectiveRole ?? null;
  // Team-derived access has no dashboard_members row to leave
  const isDirectMember = !isOwner && !!access?.directRole;
  const teamRole = access?.teamRole ?? null;
  const members = canManage ? await getDashboardMembers(dashboard.id) : [];
  const invitations = canManage
    ? await getDashboardInvitations(dashboard.id)
    : [];

  const owningTeam = dashboard.teamId ? await getTeam(dashboard.teamId) : null;
  const team = owningTeam ? { id: owningTeam.id, name: owningTeam.name } : null;

  const canTransfer =
    !!userId &&
    (isOwner ||
      (!!dashboard.teamId &&
        isTeamRoleAtLeast(
          await getActingTeamRole(userId, dashboard.teamId),
          "admin",
        )));
  const transferTargets =
    userId && canTransfer
      ? (await listEditableTeams(userId)).filter(
          (t) => t.id !== dashboard.teamId,
        )
      : [];

  const ownedCounterIdsOnDashboard = userId
    ? [
        ...new Set(
          items
            .filter(
              ({ counter }) =>
                counter?.teamId === null && counter.ownerId === userId,
            )
            .map(({ item }) => item.counterId),
        ),
      ]
    : [];

  const isFollowing = userId
    ? await isFollowingDashboard(userId, dashboard.id)
    : false;
  const followerCount = await getDashboardFollowerCount(dashboard.id);

  let ownerUsername: string | null = null;
  if (dashboard.ownerId) {
    const ownerResult = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, dashboard.ownerId));
    ownerUsername = ownerResult[0]?.username ?? null;
  }

  depends(`dashboard:${params.id}`);

  return {
    dashboard,
    items,
    canEdit,
    canDelete,
    canManage,
    isOwner,
    shareToken: canManage ? (dashboard.shareToken ?? null) : null,
    members,
    invitations,
    memberRole,
    isDirectMember,
    team,
    teamRole,
    canTransfer,
    transferTargets,
    ownedCounterIdsOnDashboard,
    isFollowing,
    followerCount,
    ownerUsername,
    hasValidToken,
    title: `${dashboard.title} | Dashboard | Count Collab`,
    description:
      dashboard.description || `${dashboard.title} dashboard on Count Collab`,
  };
};
