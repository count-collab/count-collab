import { error, json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { dashboardMembers } from "$lib/db/schema";
import { getUserDashboardRole } from "$lib/server/dashboard-members";
import { getDashboard } from "$lib/server/dashboards";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to follow dashboards");
  }

  const dashboard = await getDashboard(params.id);
  if (!dashboard) {
    throw error(404, "Dashboard not found");
  }

  if (dashboard.visibilityMode === "private") {
    throw error(403, "Cannot follow a private dashboard");
  }

  const existingRole = await getUserDashboardRole(
    session.user.id,
    dashboard.id,
  );
  if (existingRole) {
    return json({ already: true }, { status: 200 });
  }

  await db.insert(dashboardMembers).values({
    dashboardId: dashboard.id,
    userId: session.user.id,
    role: "viewer",
  });

  return json({ success: true }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to unfollow dashboards");
  }

  const existingRole = await getUserDashboardRole(session.user.id, params.id);
  if (!existingRole) {
    throw error(404, "You are not a member of this dashboard");
  }

  if (existingRole !== "viewer") {
    throw error(
      403,
      "Only viewers can unfollow. Editors and admins must be removed by an admin.",
    );
  }

  await db.delete(dashboardMembers).where(
    and(
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      eq(dashboardMembers.dashboardId, params.id as any),
      eq(dashboardMembers.userId, session.user.id),
    ),
  );

  return json({ success: true });
};
