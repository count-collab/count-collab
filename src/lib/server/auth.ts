import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { SvelteKitAuth } from "@auth/sveltekit";
import Discord from "@auth/sveltekit/providers/discord";
import Google from "@auth/sveltekit/providers/google";
import Twitch from "@auth/sveltekit/providers/twitch";
import { eq } from "drizzle-orm";
import { db } from "$lib/db";
import { accounts, sessions, users, verificationTokens } from "$lib/db/schema";

// Type assertion needed: drizzle-orm 0.29.x columns lack metadata fields
// (isAutoincrement, isPrimaryKey, etc.) that @auth/drizzle-adapter 1.x expects.
// The runtime API is identical — this is a type-level mismatch only.
const adapterTables = {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 0.29 compat
} as any;
const adapter = DrizzleAdapter(db, adapterTables);

export const {
  handle: authHandle,
  signIn,
  signOut,
} = SvelteKitAuth({
  adapter,
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    Discord({ allowDangerousEmailAccountLinking: true }),
    Twitch({ allowDangerousEmailAccountLinking: true }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      const [dbUser] = await db
        .select({
          id: users.id,
          username: users.username,
          roleId: users.roleId,
        })
        .from(users)
        .where(eq(users.id, user.id));

      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.username = dbUser.username;
        session.user.roleId = dbUser.roleId;
      }

      return session;
    },
  },
  trustHost: true,
});
