import { error, redirect } from "@sveltejs/kit";
import { asc, count as countFn, desc, eq } from "drizzle-orm";
import { slugify } from "$lib/counter";
import { db } from "$lib/db";
import { counterGoals, counterHistory, users } from "$lib/db/schema";
import { isTeamRoleAtLeast } from "$lib/roles";
import {
  canDeleteCounter,
  canEditCounter,
  canIncrementCounter,
  canIncrementPrivateCounter,
  canManageMembers,
  canViewPrivateCounter,
  getCounterAccess,
} from "$lib/server/authorize";
import {
  getCounter,
  getCounterAnonymousStats,
  getCounterHistory,
  getCounterUserStats,
} from "$lib/server/counters";
import {
  getCounterFollowerCount,
  isFollowingCounter,
} from "$lib/server/followers";
import { getCounterInvitations } from "$lib/server/invitations";
import { logger } from "$lib/server/logger";
import { getCounterMembers } from "$lib/server/members";
import { checkCounterCooldown } from "$lib/server/ratelimit";
import { getActingTeamRole } from "$lib/server/team-authorize";
import { getTeam, listEditableTeams } from "$lib/server/teams";
import { counterIdSchema } from "$lib/utils/validation";
import type { PageServerLoad } from "./$types";

const AUTO_DELETE_DAYS = 30;
const WARNING_AFTER_DAYS = 7;

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

  // Private counter access check — return 404 to avoid leaking existence
  if (isPrivate && !hasValidToken) {
    if (userId) {
      canViewPrivate = await canViewPrivateCounter(userId, counter.id);
      if (!canViewPrivate) {
        throw error(404, "Counter not found");
      }
    } else {
      throw error(404, "Counter not found");
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
    canIncrement =
      hasValidToken ||
      (!!userId &&
        (await canIncrementPrivateCounter(userId, counter.id)) === "allowed");
  }

  const access = userId ? await getCounterAccess(userId, counter.id) : null;
  const isOwner = access?.isOwner ?? false;
  // Follow button visibility: any direct or team role counts as membership
  const isMember = !isOwner && !!access?.effectiveRole;
  // Team-derived access has no counter_members row to leave
  const isDirectMember = !isOwner && !!access?.directRole;
  const teamRole = access?.teamRole ?? null;

  const members = canManage ? await getCounterMembers(counter.id) : [];
  const invitations = canManage ? await getCounterInvitations(counter.id) : [];

  const owningTeam = counter.teamId ? await getTeam(counter.teamId) : null;
  const team = owningTeam ? { id: owningTeam.id, name: owningTeam.name } : null;

  const canTransfer =
    !!userId &&
    (isOwner ||
      (!!counter.teamId &&
        isTeamRoleAtLeast(
          await getActingTeamRole(userId, counter.teamId),
          "admin",
        )));
  const transferTargets =
    userId && canTransfer
      ? (await listEditableTeams(userId)).filter((t) => t.id !== counter.teamId)
      : [];

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

  const isSubjectToAutoDelete =
    counter.ownerId === null &&
    counter.teamId === null &&
    counter.visibilityMode !== "private";

  let autoDeleteInfo: {
    inactiveDays: number;
    daysUntilDeletion: number;
    deletionDate: string;
    showWarning: boolean;
  } | null = null;

  if (isSubjectToAutoDelete) {
    const inactiveDays = Math.floor(
      (Date.now() - new Date(counter.lastActivityAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const deletionDate = new Date(
      new Date(counter.lastActivityAt).getTime() +
        AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    autoDeleteInfo = {
      inactiveDays,
      daysUntilDeletion: Math.max(0, AUTO_DELETE_DAYS - inactiveDays),
      deletionDate,
      showWarning: inactiveDays >= WARNING_AFTER_DAYS,
    };
  }
  const goals = await db
    .select()
    .from(counterGoals)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counterGoals.counterId, counter.id as any))
    .orderBy(asc(counterGoals.amount));

  const scoreboard = counter.scoreboardEnabled
    ? await db
        .select({
          userId: counterHistory.changedBy,
          username: users.username,
          image: users.image,
          actionCount: countFn(),
        })
        .from(counterHistory)
        .innerJoin(users, eq(counterHistory.changedBy, users.id))
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        .where(eq(counterHistory.counterId, counter.id as any))
        .groupBy(counterHistory.changedBy, users.username, users.image)
        .orderBy(desc(countFn()))
        .limit(20)
    : [];

  const [userStats, anonymousStats] = await Promise.all([
    userId ? getCounterUserStats(params.id, userId) : null,
    getCounterAnonymousStats(params.id),
  ]);

  depends(`counter:${params.id}`);

  // Check current cooldown state so the UI can show it on load
  const cooldownState = await checkCounterCooldown(counter.id, userId, {
    cooldownEnabled: counter.cooldownEnabled ?? false,
    cooldownSeconds: counter.cooldownSeconds ?? 0,
    ownerId: counter.ownerId,
  });
  const initialCooldownSeconds = cooldownState.blocked
    ? cooldownState.retryAfterSeconds
    : 0;
  const cooldownDuration = cooldownState.blocked
    ? cooldownState.retryAfterSeconds
    : cooldownState.cooldownSeconds;

  return {
    counter,
    history: await getCounterHistory(params.id),
    canEdit,
    canDelete,
    canManage,
    canIncrement,
    isOwner,
    isMember,
    isDirectMember,
    team,
    teamRole,
    canTransfer,
    transferTargets,
    ownerUsername,
    members,
    invitations,
    isFollowing,
    followerCount,
    initialCooldownSeconds,
    cooldownDuration,
    goals: goals.map((g) => ({
      ...g,
      reachedAt: g.reachedAt?.toISOString() ?? null,
    })),
    scoreboard: scoreboard
      .filter((s): s is typeof s & { userId: string } => s.userId !== null)
      .map((s) => ({
        ...s,
        actionCount: Number(s.actionCount),
      })),
    userStats,
    anonymousStats,
    // Only expose the share token to users who can manage the counter
    shareToken: canManage ? (counter.shareToken ?? null) : null,
    hasValidToken,
    autoDeleteInfo,
    title: `${counter.title} | Count Collab`,
    description:
      counter.description ||
      `${counter.title} counter is currently at ${counter.count}`,
  };
};
