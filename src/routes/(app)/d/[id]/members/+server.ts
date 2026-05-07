import { error, json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { dashboardMembers, dashboards, users } from "$lib/db/schema";
import { canManageDashboardMembers } from "$lib/server/dashboard-authorize";
import { createDashboardInvitation } from "$lib/server/dashboard-invitations";
import { getDashboardMembers } from "$lib/server/dashboard-members";
import { parseAndValidateBody } from "$lib/server/request";
import { emitInvitationCreated } from "$lib/utils/socket";
import {
  dashboardIdSchema,
  inviteDashboardMemberSchema,
} from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view members");
  }

  const allowed = await canManageDashboardMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to view members");
  }

  const members = await getDashboardMembers(params.id);
  return json(members);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = dashboardIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid dashboard ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to invite members");
  }

  const allowed = await canManageDashboardMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(403, "You don't have permission to manage members");
  }

  const validation = await parseAndValidateBody(
    request,
    inviteDashboardMemberSchema,
    "Member invitation",
  );
  if (!validation.success) {
    return validation.response;
  }

  const { username, role } = validation.data;

  // Look up user by username
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));

  if (!user) {
    return json({ error: "User not found" }, { status: 404 });
  }

  // Prevent self-invitation
  if (user.id === session.user.id) {
    return json({ error: "You cannot invite yourself" }, { status: 400 });
  }

  // Check if user is already a member
  const [existingMember] = await db
    .select({ id: dashboardMembers.id })
    .from(dashboardMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardMembers.dashboardId, params.id as any),
        eq(dashboardMembers.userId, user.id),
      ),
    );

  if (existingMember) {
    return json({ error: "User is already a member" }, { status: 409 });
  }

  const invitation = await createDashboardInvitation(
    params.id,
    user.id,
    role,
    session.user.id,
  );

  if (!invitation) {
    return json({ error: "Failed to create invitation" }, { status: 500 });
  }

  // Fetch dashboard title for the socket payload
  const [dashboard] = await db
    .select({ title: dashboards.title })
    .from(dashboards)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboards.id, params.id as any));

  emitInvitationCreated(user.id, {
    type: "dashboard",
    entityId: params.id,
    entityTitle: dashboard?.title ?? "Dashboard",
    role,
    inviterUsername: session.user.username ?? null,
  });

  return json(invitation, { status: 201 });
};
