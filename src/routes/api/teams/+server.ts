import { error, json } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";
import { checkTeamCreationRateLimit } from "$lib/server/ratelimit";
import { parseAndValidateBody } from "$lib/server/request";
import { createTeam, listUserTeams } from "$lib/server/teams";
import { createTeamSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to view your teams");
  }

  const teams = await listUserTeams(session.user.id);
  return json(teams);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to create a team");
  }

  const rateLimit = await checkTeamCreationRateLimit(session.user.id);
  if (rateLimit) {
    logger.warn("Team creation rate limit exceeded", {
      userId: session.user.id,
      retryAfter: rateLimit.retryAfter,
    });

    return json(
      {
        error: "Too many requests",
        retryAfterSeconds: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      },
    );
  }

  const validation = await parseAndValidateBody(
    request,
    createTeamSchema,
    "Team creation",
  );
  if (!validation.success) {
    return validation.response;
  }

  const team = await createTeam({
    name: validation.data.name,
    description: validation.data.description,
    userId: session.user.id,
  });

  return json(team, { status: 201 });
};
