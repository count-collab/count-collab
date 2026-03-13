import { error } from "@sveltejs/kit";
import {
  canDeleteDashboard,
  canEditDashboard,
  canManageDashboardMembers,
  canViewPrivateDashboard,
} from "$lib/server/authorize";
import { getDashboardMembers } from "$lib/server/dashboard-members";
import {
  getDashboard,
  getDashboardCounters,
} from "$lib/server/dashboards";
import { logger } from "$lib/server/logger";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { PageServerLoad } from "./$types";

const COUNTERS_PER_PAGE = 24;

export const load: PageServerLoad = async ({ params, locals, url }) => {
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

  // Private dashboard access check
  if (!dashboard.isPublic && userId) {
    const canView = await canViewPrivateDashboard(userId, dashboard.id);
    if (!canView) {
      throw error(403, "You don't have access to this dashboard");
    }
  } else if (!dashboard.isPublic && !userId) {
    throw error(403, "Sign in to view this private dashboard");
  }

  const canEdit = userId ? await canEditDashboard(userId, dashboard.id) : false;
  const canDelete = userId
    ? await canDeleteDashboard(userId, dashboard.id)
    : false;
  const canManage = userId
    ? await canManageDashboardMembers(userId, dashboard.id)
    : false;

  const isOwner = userId ? dashboard.ownerId === userId : false;
  const members = canManage ? await getDashboardMembers(dashboard.id) : [];

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const offset = (page - 1) * COUNTERS_PER_PAGE;
  const { items: counters, total: totalCounters } = await getDashboardCounters(
    dashboard.id,
    COUNTERS_PER_PAGE,
    offset,
  );

  return {
    dashboard,
    counters,
    counterPage: page,
    counterTotalPages: Math.max(
      1,
      Math.ceil(totalCounters / COUNTERS_PER_PAGE),
    ),
    totalCounters,
    canEdit,
    canDelete,
    canManage,
    isOwner,
    members,
  };
};
