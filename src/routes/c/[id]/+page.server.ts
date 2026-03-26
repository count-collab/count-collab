import { error } from "@sveltejs/kit";
import {
  canDeleteCounter,
  canEditCounter,
  canManageMembers,
  canViewPrivateCounter,
} from "$lib/server/authorize";
import { getCounter, getCounterHistory } from "$lib/server/counters";
import { logger } from "$lib/server/logger";
import { getCounterMembers } from "$lib/server/members";
import { counterIdSchema } from "$lib/utils/validation";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({
  params,
  depends,
  locals,
  url,
}) => {
  // Validate UUID format
  const idValidation = counterIdSchema.safeParse(params.id);

  if (!idValidation.success) {
    logger.warn("Invalid counter ID format", { id: params.id });
    throw error(400, "Invalid counter ID format");
  }

  const counter = await getCounter(params.id);

  if (!counter) {
    logger.warn("Counter not found", { id: params.id });
    throw error(404, "Counter not found");
  }

  const session = await locals.auth();
  const userId = session?.user?.id;

  // Check if a valid share token was provided
  const token = url.searchParams.get("token");
  const hasValidToken =
    !counter.isPublic &&
    !!token &&
    !!counter.shareToken &&
    token === counter.shareToken;

  // Private counter access check
  if (!counter.isPublic && !hasValidToken) {
    if (userId) {
      const canView = await canViewPrivateCounter(userId, counter.id);
      if (!canView) {
        throw error(403, "You don't have access to this counter");
      }
    } else {
      throw error(403, "Sign in to view this private counter");
    }
  }

  const canEdit = userId ? await canEditCounter(userId, counter.id) : false;
  const canDelete = userId ? await canDeleteCounter(userId, counter.id) : false;
  const canManage = userId ? await canManageMembers(userId, counter.id) : false;

  const isOwner = userId ? counter.ownerId === userId : false;
  const members = canManage ? await getCounterMembers(counter.id) : [];

  depends(`counter:${params.id}`);

  return {
    counter,
    history: await getCounterHistory(params.id),
    canEdit,
    canDelete,
    canManage,
    isOwner,
    members,
    // Only expose the share token to users who can manage the counter
    shareToken: canManage ? (counter.shareToken ?? null) : null,
    hasValidToken,
    title: `${counter.title} | Count Collab`,
    description:
      counter.description ||
      `${counter.title} counter is currently at ${counter.count}`,
  };
};
