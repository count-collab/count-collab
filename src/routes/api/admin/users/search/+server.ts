import { error, json } from "@sveltejs/kit";
import { hasPermission } from "$lib/server/permissions";
import { listUsers } from "$lib/server/users";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Unauthorized");
  }

  const isAdmin = await hasPermission(session.user.id, "user:manage");
  if (!isAdmin) {
    throw error(403, "Forbidden");
  }

  const query = url.searchParams.get("q")?.trim();
  if (!query || query.length < 1) {
    throw error(400, "Search query is required");
  }

  const result = await listUsers(20, query);

  return json({
    users: result.items.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      image: u.image,
    })),
  });
};
