import { error, json } from "@sveltejs/kit";
import { hasPermission } from "$lib/server/permissions";
import { updateUserRole, deleteUser } from "$lib/server/users";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Unauthorized");
  }

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) {
    throw error(403, "Forbidden");
  }

  const body = await request.json();
  const { roleId } = body;

  if (typeof roleId !== "number") {
    throw error(400, "Invalid roleId");
  }

  // Prevent self-demotion
  if (params.userId === session.user.id) {
    throw error(400, "Cannot change your own role");
  }

  const updated = await updateUserRole(params.userId, roleId);
  if (!updated) {
    throw error(404, "User not found");
  }

  return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Unauthorized");
  }

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) {
    throw error(403, "Forbidden");
  }

  // Prevent self-deletion
  if (params.userId === session.user.id) {
    throw error(400, "Cannot delete your own account");
  }

  const deleted = await deleteUser(params.userId);
  if (!deleted) {
    throw error(404, "User not found");
  }

  return json({ success: true });
};
