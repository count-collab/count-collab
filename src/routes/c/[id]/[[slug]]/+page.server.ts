import { error, redirect } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { slugify } from "$lib/counter";
import { db } from "$lib/db";
import { counterMembers, users } from "$lib/db/schema";
import {
  canDeleteCounter,
  canEditCounter,
  canIncrementCounter,
  canManageMembers,
  canViewPrivateCounter,
} from "$lib/server/authorize";
import { getCounter, getCounterHistory } from "$lib/server/counters";
import {
  getCounterFollowerCount,
  isFollowingCounter,
} from "$lib/server/followers";
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

  // Redirect to canonical URL with slug
  const expectedSlug = slugify(counter.title);
  if (expectedSlug && params.slug !== expectedSlug) {
    const target = `/c/${params.id}/${expectedSlug}`;
    const query = url.search;
    throw redirect(301, `${target}${query}`);
  }

  const session = await locals.auth();
  const userId = session?.user?.id;
  const isPrivate = counter.visibilityMode === "private";

  // Check if a valid share token was provided
  const token = url.searchParams.get("token");
  const hasValidToken =
    isPrivate &&
    !!token &&
    !!counter.shareToken &&
    token === counter.shareToken;

  let canViewPrivate = false;

  // Private counter access check
  if (isPrivate && !hasValidToken) {
    if (userId) {
      canViewPrivate = await canViewPrivateCounter(userId, counter.id);
      if (!canViewPrivate) {
        throw error(403, "You don't have access to this counter");
      }
    } else {
      throw error(403, "Sign in to view this private counter");
    }
  }

  const canEdit = userId ? await canEditCounter(userId, counter.id) : false;
  const canDelete = userId ? await canDeleteCounter(userId, counter.id) : false;
  const canManage = userId ? await canManageMembers(userId, counter.id) : false;

  let canIncrement = false;

  if (counter.visibilityMode === "public") {
    canIncrement = true;
  } else if (counter.visibilityMode === "public_readonly") {
    canIncrement = userId
      ? await canIncrementCounter(userId, counter.id)
      : false;
  } else {
    canIncrement = hasValidToken || canViewPrivate;
  }

  const isOwner = userId ? counter.ownerId === userId : false;
  const members = canManage ? await getCounterMembers(counter.id) : [];

  // Check membership directly for follow button visibility (independent of admin permissions)
  let isMember = false;
  if (userId && !isOwner) {
    const [memberRow] = await db
      .select({ id: counterMembers.id })
      .from(counterMembers)
      .where(
        and(
          // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
          eq(counterMembers.counterId, counter.id as any),
          eq(counterMembers.userId, userId),
        ),
      );
    isMember = !!memberRow;
  }

  const isFollowing = userId
    ? await isFollowingCounter(userId, counter.id)
    : false;
  const followerCount = await getCounterFollowerCount(counter.id);

  let ownerUsername: string | null = null;
  if (counter.ownerId) {
    const ownerResult = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, counter.ownerId));
    ownerUsername = ownerResult[0]?.username ?? null;
  }

  depends(`counter:${params.id}`);

  return {
    counter,
    history: await getCounterHistory(params.id),
    canEdit,
    canDelete,
    canManage,
    canIncrement,
    isOwner,
    isMember,
    ownerUsername,
    members,
    isFollowing,
    followerCount,
    // Only expose the share token to users who can manage the counter
    shareToken: canManage ? (counter.shareToken ?? null) : null,
    hasValidToken,
    title: `${counter.title} | Count Collab`,
    description:
      counter.description ||
      `${counter.title} counter is currently at ${counter.count}`,
  };
};
