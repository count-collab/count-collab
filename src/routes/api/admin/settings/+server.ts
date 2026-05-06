import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/db";
import { globalSettings } from "$lib/db/schema";
import { logger } from "$lib/server/logger";
import { getUserRole } from "$lib/server/permissions";
import { resetSettingsCache } from "$lib/server/ratelimit";
import { parseAndValidateBody } from "$lib/server/request";
import { updateGlobalSettingsSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) throw error(401, "Sign in required");
  const role = await getUserRole(session.user.id);
  if (role !== "admin") throw error(403, "Admin access required");

  // Upsert: ensure row exists with defaults
  const [settings] = await db
    .insert(globalSettings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();

  if (settings) {
    return json(settings);
  }

  // Row already existed, fetch it
  const [existing] = await db
    .select()
    .from(globalSettings)
    .where(eq(globalSettings.id, 1));

  return json(existing);
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) throw error(401, "Sign in required");
  const role = await getUserRole(session.user.id);
  if (role !== "admin") throw error(403, "Admin access required");

  const validation = await parseAndValidateBody(
    request,
    updateGlobalSettingsSchema,
    "Global settings update",
  );
  if (!validation.success) {
    return validation.response;
  }

  const data = validation.data;
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (data.counterCreationLimitAuth !== undefined)
    set.counterCreationLimitAuth = data.counterCreationLimitAuth;
  if (data.counterCreationWindowAuth !== undefined)
    set.counterCreationWindowAuth = data.counterCreationWindowAuth;
  if (data.counterCreationLimitUnauth !== undefined)
    set.counterCreationLimitUnauth = data.counterCreationLimitUnauth;
  if (data.counterCreationWindowUnauth !== undefined)
    set.counterCreationWindowUnauth = data.counterCreationWindowUnauth;
  if (data.dashboardCreationLimitAuth !== undefined)
    set.dashboardCreationLimitAuth = data.dashboardCreationLimitAuth;
  if (data.dashboardCreationWindowAuth !== undefined)
    set.dashboardCreationWindowAuth = data.dashboardCreationWindowAuth;
  if (data.dashboardCreationLimitUnauth !== undefined)
    set.dashboardCreationLimitUnauth = data.dashboardCreationLimitUnauth;
  if (data.dashboardCreationWindowUnauth !== undefined)
    set.dashboardCreationWindowUnauth = data.dashboardCreationWindowUnauth;
  if (data.incrementCooldownMsAuth !== undefined)
    set.incrementCooldownMsAuth = data.incrementCooldownMsAuth;
  if (data.incrementCooldownMsUnauth !== undefined)
    set.incrementCooldownMsUnauth = data.incrementCooldownMsUnauth;

  // Ensure row exists before updating
  await db.insert(globalSettings).values({ id: 1 }).onConflictDoNothing();

  const [updated] = await db
    .update(globalSettings)
    .set(set)
    .where(eq(globalSettings.id, 1))
    .returning();

  resetSettingsCache();
  logger.info("Global settings updated", { updatedBy: session.user.id });
  return json(updated);
};
