import { buildInfo } from "$lib/server/build-info.generated";
import { getUserPendingInvitationCount } from "$lib/server/invitations";
import { hasPermission } from "$lib/server/permissions";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = await locals.auth();

  let isAdmin = false;
  let pendingInvitationCount = 0;
  if (session?.user?.id) {
    [isAdmin, pendingInvitationCount] = await Promise.all([
      hasPermission(session.user.id, "user:manage"),
      getUserPendingInvitationCount(session.user.id),
    ]);
  }

  return {
    session,
    isAdmin,
    pendingInvitationCount,
    buildInfo: {
      version: buildInfo.version,
      commit: buildInfo.commit,
    },
  };
};
