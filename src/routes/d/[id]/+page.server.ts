import { error } from "@sveltejs/kit";
import {
  canIncrementCounter,
  canViewPrivateCounter,
} from "$lib/server/authorize";
import { getCounter } from "$lib/server/counters";
import {
  canDeleteDashboard,
  canEditDashboard,
  canManageDashboardMembers,
  canViewDashboard,
  isDashboardOwner,
} from "$lib/server/dashboard-authorize";
import { getDashboardItems } from "$lib/server/dashboard-items";
import {
  getDashboardMembers,
  getUserDashboardRole,
} from "$lib/server/dashboard-members";
import { getDashboard } from "$lib/server/dashboards";
import {
  getDashboardFollowerCount,
  isFollowingDashboard,
} from "$lib/server/followers";
import { logger } from "$lib/server/logger";
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
  const isOwner = userId ? await isDashboardOwner(userId, dashboard.id) : false;
  const members = canManage ? await getDashboardMembers(dashboard.id) : [];
  const memberRole = userId
    ? await getUserDashboardRole(userId, dashboard.id)
    : null;

  const isFollowing = userId
    ? await isFollowingDashboard(userId, dashboard.id)
    : false;
  const followerCount = await getDashboardFollowerCount(dashboard.id);

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
    memberRole,
    isFollowing,
    followerCount,
    hasValidToken,
    title: `${dashboard.title} | Count Collab`,
    description:
      dashboard.description || `${dashboard.title} dashboard on Count Collab`,
  };
};
