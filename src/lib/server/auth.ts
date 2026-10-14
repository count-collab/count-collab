import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { SvelteKitAuth } from "@auth/sveltekit";
import Discord from "@auth/sveltekit/providers/discord";
import Google from "@auth/sveltekit/providers/google";
import Twitch from "@auth/sveltekit/providers/twitch";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import { accounts, sessions, users, verificationTokens } from "$lib/db/schema";
import { shouldAllowSignIn } from "$lib/server/auth-policy";
import { logEvent } from "$lib/server/events";
import { toClientSessionUser } from "$lib/server/session-user";
// Side effect: registers globalThis.__socketGateway, which server.js uses to start
// Socket.IO. hooks.server.ts imports this file, so it loads before the server listens.
import "$lib/server/socket-server";

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
    // Email linking is only safe for Google because signIn requires email_verified.
    Google({ allowDangerousEmailAccountLinking: true }),
    Discord,
    Twitch,
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (!account) return false;
      return shouldAllowSignIn({
        provider: account.provider,
        profile,
        hasLinkedAccount: async () => {
          const [row] = await db
            .select({ userId: accounts.userId })
            .from(accounts)
            .where(
              and(
                eq(accounts.provider, account.provider),
                eq(accounts.providerAccountId, account.providerAccountId),
              ),
            )
            .limit(1);
          return !!row;
        },
      });
    },
    async session({ session, user }) {
      const [dbUser] = await db
        .select({
          id: users.id,
          username: users.username,
          roleId: users.roleId,
        })
        .from(users)
        .where(eq(users.id, user.id));

      return { ...session, user: toClientSessionUser(session.user, dbUser) };
    },
  },
  trustHost: true,
  events: {
    async createUser({ user }) {
      logEvent({
        eventType: "user_registered",
        userId: user.id ?? null,
        entityId: user.id ?? null,
        entityType: "user",
        metadata: {
          email: user.email ?? null,
        },
      });
    },
  },
});
