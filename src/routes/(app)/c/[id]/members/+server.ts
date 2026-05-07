import { error, json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { counterMembers, counters, users } from "$lib/db/schema";
import { canManageMembers } from "$lib/server/authorize";
import { createCounterInvitation } from "$lib/server/invitations";
import { getCounterMembers } from "$lib/server/members";
import { parseAndValidateBody } from "$lib/server/request";
import { emitInvitationCreated } from "$lib/utils/socket";
import { counterIdSchema, inviteMemberSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view members");
  }

  const allowed = await canManageMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(404, "Counter not found");
  }

  const members = await getCounterMembers(params.id);
  return json(members);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = counterIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid counter ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to invite members");
  }

  const allowed = await canManageMembers(session.user.id, params.id);
  if (!allowed) {
    throw error(404, "Counter not found");
  }

  const validation = await parseAndValidateBody(
    request,
    inviteMemberSchema,
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
    .select({ id: counterMembers.id })
    .from(counterMembers)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(counterMembers.counterId, params.id as any),
        eq(counterMembers.userId, user.id),
      ),
    );

  if (existingMember) {
    return json({ error: "User is already a member" }, { status: 409 });
  }

  const invitation = await createCounterInvitation(
    params.id,
    user.id,
    role,
    session.user.id,
  );

  if (!invitation) {
    return json({ error: "Failed to create invitation" }, { status: 500 });
  }

  // Fetch counter title for the socket payload
  const [counter] = await db
    .select({ title: counters.title })
    .from(counters)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(counters.id, params.id as any));

  emitInvitationCreated(user.id, {
    type: "counter",
    entityId: params.id,
    entityTitle: counter?.title ?? "Counter",
    role,
    inviterUsername: session.user.username ?? null,
  });

  return json(invitation, { status: 201 });
};
