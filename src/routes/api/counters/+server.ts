import { error, json } from "@sveltejs/kit";
import { createCounter } from "$lib/server/counters";
import { parseAndValidateBody } from "$lib/server/request";
import { canEditTeamResources } from "$lib/server/team-authorize";
import { emitCounterCreated } from "$lib/utils/socket";
import { createCounterSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
  const validation = await parseAndValidateBody(
    request,
    createCounterSchema,
    "Counter creation",
  );

  if (!validation.success) {
    return validation.response;
  }

  const { title, description, visibility, counterMode, teamId } =
    validation.data;

  const session = await locals.auth();
  const isAuthenticated = !!session?.user?.id;

  if (teamId) {
    if (!session?.user?.id) {
      throw error(401, "Sign in to create team counters");
    }
    if (!(await canEditTeamResources(session.user.id, teamId))) {
      throw error(403, "You cannot create counters in this team");
    }
  }

  const counter = await createCounter({
    title,
    description,
    visibilityMode: isAuthenticated ? visibility : "public",
    counterMode,
    ownerId: session?.user?.id ?? null,
    teamId: teamId ?? null,
  });

  emitCounterCreated(counter.id);

  return json({ id: counter.id, title: counter.title }, { status: 201 });
};
