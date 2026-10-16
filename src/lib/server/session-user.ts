import type { Session } from "@auth/sveltekit";

type ClientSessionUser = Session["user"];

type SessionUserSource = {
  id?: string | null;
  email?: string | null;
  image?: string | null;
};

type DbUserFields = {
  id: string;
  username: string | null;
  roleId: number | null;
};

/**
 * Whitelists the user fields sent to the client; the OAuth full name is never included.
 */
export function toClientSessionUser(
  sessionUser: SessionUserSource,
  dbUser: DbUserFields | undefined,
): ClientSessionUser {
  return {
    id: dbUser?.id ?? sessionUser.id ?? "",
    email: sessionUser.email ?? null,
    image: sessionUser.image ?? null,
    username: dbUser?.username ?? null,
    roleId: dbUser?.roleId ?? null,
  };
}
