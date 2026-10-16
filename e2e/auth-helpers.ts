import type { Browser, BrowserContext } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  counters,
  dashboards,
  platformEvents,
  sessions,
  teams,
  users as usersTable,
} from "../src/lib/db/schema";

export type TestUser = {
  id: string;
  username: string;
  name: string;
  sessionToken: string;
};

function shortId(): string {
  return Math.random().toString(16).slice(2, 10);
}

/** Insert a user with a valid database session. */
export async function createTestUser(label: string): Promise<TestUser> {
  const suffix = shortId();
  const user: TestUser = {
    id: `e2e-${label}-${Date.now()}-${suffix}`,
    username: `e2e_${label}_${suffix}`.toLowerCase(),
    name: `E2E ${label} ${suffix}`,
    sessionToken: `e2e-session-${label}-${Date.now()}-${suffix}`,
  };

  await db.insert(usersTable).values({
    id: user.id,
    name: user.name,
    email: `${user.id}@example.com`,
    username: user.username,
  });
  await db.insert(sessions).values({
    sessionToken: user.sessionToken,
    userId: user.id,
    expires: new Date(Date.now() + 60 * 60 * 1000),
  });

  return user;
}

export async function authenticate(
  context: BrowserContext,
  user: TestUser,
): Promise<void> {
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: user.sessionToken,
      domain: "localhost",
      path: "/",
    },
  ]);
}

export async function newAuthedContext(
  browser: Browser,
  user: TestUser,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  await authenticate(context, user);
  return context;
}

/** Remove teams and their resources; counters/dashboards first because of the restrict FK. */
export async function deleteTeams(teamIds: string[]): Promise<void> {
  if (teamIds.length === 0) return;
  // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
  const ids = teamIds as any;
  await db.delete(counters).where(inArray(counters.teamId, ids));
  await db.delete(dashboards).where(inArray(dashboards.teamId, ids));
  await db.delete(teams).where(inArray(teams.id, ids));
}

export async function deleteCounters(counterIds: string[]): Promise<void> {
  if (counterIds.length === 0) return;
  // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
  await db.delete(counters).where(inArray(counters.id, counterIds as any));
}

/** Delete users (sessions and memberships cascade) and the events they produced. */
export async function deleteUsers(users: TestUser[]): Promise<void> {
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await db.delete(platformEvents).where(inArray(platformEvents.userId, ids));
  await db.delete(usersTable).where(inArray(usersTable.id, ids));
}
