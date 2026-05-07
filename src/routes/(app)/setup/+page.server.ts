import { fail, redirect } from "@sveltejs/kit";
import { getPostHogClient } from "$lib/server/posthog";
import { isUsernameAvailable, setUsername } from "$lib/server/users";
import { usernameSchema } from "$lib/utils/validation";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();

  if (!session?.user) {
    throw redirect(303, "/login");
  }

  if (session.user.username) {
    throw redirect(303, "/home");
  }

  return { session };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const session = await locals.auth();
    if (!session?.user) {
      throw redirect(303, "/login");
    }

    const formData = await request.formData();
    const rawUsername = formData.get("username");

    const parsed = usernameSchema.safeParse(rawUsername);
    if (!parsed.success) {
      return fail(400, {
        username: String(rawUsername ?? ""),
        error: parsed.error.flatten().formErrors[0] ?? "Invalid username",
      });
    }

    const username = parsed.data;
    const available = await isUsernameAvailable(username);
    if (!available) {
      return fail(400, {
        username,
        error: "This username is already taken",
      });
    }

    await setUsername(session.user.id, username);

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: session.user.id,
      event: "user_signed_up",
      properties: {
        username,
        $set: { username },
      },
    });
    await posthog.flush();

    throw redirect(303, "/home");
  },
};
