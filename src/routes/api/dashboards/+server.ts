import { error, json } from "@sveltejs/kit";
import { createDashboard } from "$lib/server/dashboards";
import { parseAndValidateBody } from "$lib/server/request";
import { canEditTeamResources } from "$lib/server/team-authorize";
import { emitDashboardCreated } from "$lib/utils/socket";
import { createDashboardSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, locals }) => {
  const validation = await parseAndValidateBody(
    request,
    createDashboardSchema,
    "Dashboard creation",
  );

  if (!validation.success) {
    return validation.response;
  }

  const { title, description, visibility, teamId } = validation.data;

  const session = await locals.auth();
  const isAuthenticated = !!session?.user?.id;

  if (!isAuthenticated) {
    return json(
      { error: "You must be signed in to create a dashboard." },
      { status: 401 },
    );
  }

  if (teamId && !(await canEditTeamResources(session.user.id, teamId))) {
    throw error(403, "You cannot create dashboards in this team");
  }

  const dashboard = await createDashboard({
    title,
    description,
    visibilityMode: visibility,
    ownerId: session.user.id,
    teamId: teamId ?? null,
  });

  emitDashboardCreated(dashboard.id);

  return json({ id: dashboard.id }, { status: 201 });
};
