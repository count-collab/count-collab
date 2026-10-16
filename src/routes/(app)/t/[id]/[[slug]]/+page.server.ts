import { error, redirect } from "@sveltejs/kit";
import { slugify } from "$lib/counter";
import { getTeamInvitations } from "$lib/server/invitations";
import { logger } from "$lib/server/logger";
import {
  canDeleteTeam,
  canEditTeamResources,
  canManageTeam,
  canViewTeam,
  getActingTeamRole,
} from "$lib/server/team-authorize";
import { getTeamMembers } from "$lib/server/team-members";
import { getTeam, getTeamResources } from "$lib/server/teams";
import { teamIdSchema } from "$lib/utils/validation";
import type { PageServerLoad } from "./$types";

// Sibling routes under /t/[id]/ that a slug must not redirect into
const RESERVED_SLUGS = new Set(["join", "members", "invitations"]);

export const load: PageServerLoad = async ({ params, locals, url }) => {
  const session = await locals.auth();
  const userId = session?.user?.id;

  if (!userId) {
    const redirectTo = encodeURIComponent(`${url.pathname}${url.search}`);
    throw redirect(303, `/login?redirectTo=${redirectTo}`);
  }

  if (!teamIdSchema.safeParse(params.id).success) {
    throw error(404, "Team not found");
  }

  if (!(await canViewTeam(userId, params.id))) {
    logger.warn("Team view denied", { teamId: params.id, userId });
    throw error(404, "Team not found");
  }

  const team = await getTeam(params.id);
  if (!team) {
    throw error(404, "Team not found");
  }

  const expectedSlug = slugify(team.name);
  if (
    expectedSlug &&
    !RESERVED_SLUGS.has(expectedSlug) &&
    params.slug !== expectedSlug
  ) {
    throw redirect(301, `/t/${params.id}/${expectedSlug}${url.search}`);
  }

  const [role, canManage, canDelete, canEditResources, members, resources] =
    await Promise.all([
      getActingTeamRole(userId, team.id),
      canManageTeam(userId, team.id),
      canDeleteTeam(userId, team.id),
      canEditTeamResources(userId, team.id),
      getTeamMembers(team.id),
      getTeamResources(team.id),
    ]);

  const invitations = canManage ? await getTeamInvitations(team.id) : [];
  const { joinToken, joinRole, ...teamData } = team;

  return {
    team: teamData,
    role,
    members,
    invitations,
    resources,
    canManage,
    canDelete,
    canEditResources,
    // Join link secrets are only for team managers
    joinToken: canManage ? joinToken : null,
    joinRole: canManage ? joinRole : null,
    title: `${team.name} | Team | Count Collab`,
  };
};
