import { json } from "@sveltejs/kit";
import { isUsernameAvailable } from "$lib/server/users";
import { usernameSchema } from "$lib/utils/validation";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const raw = url.searchParams.get("username");
  const parsed = usernameSchema.safeParse(raw);

  if (!parsed.success) {
    return json({ available: false, error: "Invalid username format" });
  }

  const available = await isUsernameAvailable(parsed.data);
  return json({ available });
};
