import { fail, redirect } from "@sveltejs/kit";
import { getOwnedCounterCount } from "$lib/server/counters";
import { getMembershipCount } from "$lib/server/members";
import { deleteUser, getConnectedProviders } from "$lib/server/users";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    throw redirect(303, "/login");
  }

  const [providers, ownedCounterCount, membershipCount] = await Promise.all([
    getConnectedProviders(session.user.id),
    getOwnedCounterCount(session.user.id),
    getMembershipCount(session.user.id),
  ]);

  return { providers, ownedCounterCount, membershipCount };
};

export const actions: Actions = {
  delete: async ({ request, locals }) => {
    const session = await locals.auth();
    if (!session?.user?.id) {
      return fail(401, { error: "Unauthorized" });
    }

    const formData = await request.formData();
    const confirmUsername = formData.get("confirmUsername");

    if (confirmUsername !== session.user.username) {
      return fail(400, { error: "Username does not match" });
    }

    await deleteUser(session.user.id);

    // Session is already invalidated by FK cascade (user deletion removes sessions).
    // The cookie will reference a deleted session, and Auth.js returns null on next auth() call.
    throw redirect(303, "/home");
  },
};
