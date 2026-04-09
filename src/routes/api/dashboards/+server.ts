import { json } from "@sveltejs/kit";
import { createDashboard } from "$lib/server/dashboards";
import { parseAndValidateBody } from "$lib/server/request";
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

  const { title, description, visibility } = validation.data;

  const session = await locals.auth();
  const isAuthenticated = !!session?.user?.id;

  const dashboard = await createDashboard({
    title,
    description,
    visibilityMode: isAuthenticated ? visibility : "public",
    ownerId: session?.user?.id ?? null,
  });

  emitDashboardCreated(dashboard.id);

  return json({ id: dashboard.id }, { status: 201 });
};
