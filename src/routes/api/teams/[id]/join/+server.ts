import { error, json } from "@sveltejs/kit";
import { parseAndValidateBody } from "$lib/server/request";
import { TeamLimitError, teamLimitResponse } from "$lib/server/team-limits";
import { joinTeamByToken } from "$lib/server/team-members";
import { emitTeamMembershipChanged } from "$lib/utils/socket";
import { joinTeamSchema, teamIdSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const idValidation = teamIdSchema.safeParse(params.id);
  if (!idValidation.success) {
    throw error(400, "Invalid team ID format");
  }

  const session = await locals.auth();
  if (!session?.user?.id) {
    throw error(401, "Sign in to join teams");
  }

  const validation = await parseAndValidateBody(
    request,
    joinTeamSchema,
    "Team join",
  );
  if (!validation.success) {
    return validation.response;
  }

  let result: Awaited<ReturnType<typeof joinTeamByToken>>;
  try {
    result = await joinTeamByToken(
      params.id,
      session.user.id,
      validation.data.token,
    );
  } catch (err) {
    if (err instanceof TeamLimitError) {
      return teamLimitResponse(err);
    }
    throw err;
  }
  if (!result.ok) {
    return json({ error: result.message }, { status: result.status });
  }

  if (!result.alreadyMember) {
    emitTeamMembershipChanged([session.user.id], {
      teamId: params.id,
      reason: "joined",
    });
  }

  return json({ alreadyMember: result.alreadyMember });
};
