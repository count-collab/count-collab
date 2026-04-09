import { error, json } from "@sveltejs/kit";
import { and, desc, eq, ilike, inArray, notInArray, or } from "drizzle-orm";
import { db } from "$lib/db";
import { counterMembers, counters as countersTable } from "$lib/db/schema";
import { escapeLikePattern } from "$lib/server/crypto";
import { canEditDashboard } from "$lib/server/dashboard-authorize";
import { getDashboardItems } from "$lib/server/dashboard-items";
import { dashboardIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to search counters");
  }

  const allowed = await canEditDashboard(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to edit this dashboard");
  }

  const userId = session.user.id;
  const q = url.searchParams.get("q")?.trim() || "";
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 10, 1),
    20,
  );

  // Get counter IDs already on this dashboard
  const existingItems = await getDashboardItems(params.id);
  const existingCounterIds = existingItems.map((item) => item.counterId);

  // Build membership subquery: counters the user is a member of
  const memberCounterIds = db
    .select({ counterId: counterMembers.counterId })
    .from(counterMembers)
    .where(eq(counterMembers.userId, userId));

  // Visibility: public counters OR owned by user OR user is a member
  const visibilityCondition = or(
    eq(countersTable.visibilityMode, "public"),
    eq(countersTable.visibilityMode, "public_readonly"),
    eq(countersTable.ownerId, userId),
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    inArray(countersTable.id, memberCounterIds as any),
  );

  const conditions = [visibilityCondition];

  // Search filter
  if (q) {
    conditions.push(ilike(countersTable.title, `%${escapeLikePattern(q)}%`));
  }

  // Exclude counters already in the dashboard
  if (existingCounterIds.length > 0) {
    conditions.push(notInArray(countersTable.id, existingCounterIds));
  }

  const items = await db
    .select({
      id: countersTable.id,
      title: countersTable.title,
      description: countersTable.description,
      count: countersTable.count,
      visibilityMode: countersTable.visibilityMode,
      ownerId: countersTable.ownerId,
    })
    .from(countersTable)
    .where(and(...conditions))
    .orderBy(desc(countersTable.count), desc(countersTable.updatedAt))
    .limit(limit);

  return json({ items, userId });
};
