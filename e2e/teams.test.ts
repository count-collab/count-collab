import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  test,
} from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  counters,
  type TeamMemberRole,
  teamMembers,
  teams,
} from "../src/lib/db/schema";
import {
  authenticate,
  createTestUser,
  deleteCounters,
  deleteTeams,
  deleteUsers,
  newAuthedContext,
  type TestUser,
} from "./auth-helpers";

let owner: TestUser;
let member: TestUser;
let outsider: TestUser;
let extraUsers: TestUser[];
let teamIds: string[];
let counterIds: string[];
let contexts: BrowserContext[];

test.beforeEach(async () => {
  extraUsers = [];
  teamIds = [];
  counterIds = [];
  contexts = [];
  owner = await createTestUser("owner");
  member = await createTestUser("member");
  outsider = await createTestUser("outsider");
});

test.afterEach(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  await deleteCounters(counterIds);
  await deleteTeams(teamIds);
  await deleteUsers([owner, member, outsider, ...extraUsers]);
});

async function seedTeam(
  members: [TestUser, TeamMemberRole][] = [],
): Promise<{ id: string; name: string }> {
  const name = `E2E Team ${Math.random().toString(16).slice(2, 8)}`;
  const [team] = await db
    .insert(teams)
    .values({ name, createdBy: owner.id })
    .returning({ id: teams.id });
  teamIds.push(team.id);

  await db
    .insert(teamMembers)
    .values(
      [[owner, "owner"] as [TestUser, TeamMemberRole], ...members].map(
        ([user, role]) => ({ teamId: team.id, userId: user.id, role }),
      ),
    );
  return { id: team.id, name };
}

async function seedPrivateCounter(values: {
  teamId?: string;
  ownerId?: string;
}): Promise<{ id: string; title: string }> {
  const title = `E2E Team Counter ${Math.random().toString(16).slice(2, 8)}`;
  const [counter] = await db
    .insert(counters)
    .values({
      title,
      visibilityMode: "private",
      isPublic: 0,
      cooldownEnabled: false,
      ...values,
    })
    .returning({ id: counters.id });
  counterIds.push(counter.id);
  return { id: counter.id, title };
}

async function requestAs(
  browser: Browser,
  user: TestUser,
): Promise<APIRequestContext> {
  const context = await newAuthedContext(browser, user);
  contexts.push(context);
  return context.request;
}

async function getRole(
  teamId: string,
  userId: string,
): Promise<TeamMemberRole | null> {
  const [row] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  return row?.role ?? null;
}

test("private team counter: viewer can view but not increment, incrementer can increment, outsider gets 404", async ({
  browser,
}) => {
  const viewer = member;
  const incrementer = await createTestUser("incr");
  extraUsers.push(incrementer);

  const team = await seedTeam([
    [viewer, "viewer"],
    [incrementer, "incrementer"],
  ]);
  const counter = await seedPrivateCounter({ teamId: team.id });

  const viewerContext = await newAuthedContext(browser, viewer);
  contexts.push(viewerContext);
  const viewerPage = await viewerContext.newPage();
  const viewResponse = await viewerPage.goto(`/c/${counter.id}`);
  expect(viewResponse?.status()).toBe(200);
  await expect(viewerPage.getByText(counter.title).first()).toBeVisible();

  const viewerIncrement = await viewerContext.request.post(
    `/api/counters/${counter.id}`,
  );
  expect(viewerIncrement.status()).toBe(403);

  const incrementerRequest = await requestAs(browser, incrementer);
  // Private counters have a 100ms debounce, so retry briefly on 429
  await expect
    .poll(
      async () =>
        (await incrementerRequest.post(`/api/counters/${counter.id}`)).status(),
      { intervals: [200, 200, 500] },
    )
    .toBe(200);

  const outsiderRequest = await requestAs(browser, outsider);
  expect((await outsiderRequest.get(`/c/${counter.id}`)).status()).toBe(404);
  expect((await outsiderRequest.get(`/t/${team.id}`)).status()).toBe(404);
  expect(
    (await outsiderRequest.post(`/api/counters/${counter.id}`)).status(),
  ).toBe(404);
});

test("invite flow: owner invites member as editor, member accepts and shows in Members tab", async ({
  browser,
}) => {
  const team = await seedTeam();
  const ownerContext = await newAuthedContext(browser, owner);
  contexts.push(ownerContext);
  const ownerRequest = ownerContext.request;
  const memberRequest = await requestAs(browser, member);

  const invite = await ownerRequest.post(`/t/${team.id}/members`, {
    data: { username: member.username, role: "editor" },
  });
  expect(invite.status()).toBe(201);

  // Not a member until the invitation is accepted
  expect((await memberRequest.get(`/t/${team.id}`)).status()).toBe(404);

  const accept = await memberRequest.post(`/api/invitations/team/${team.id}`);
  expect(accept.status()).toBe(201);
  expect(await accept.json()).toMatchObject({ role: "editor" });

  const page = await ownerContext.newPage();
  await page.goto(`/t/${team.id}`);
  await page.getByRole("tab", { name: /Members/ }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading", { name: "Members" })).toBeVisible();
  await expect(panel.getByText(member.name, { exact: true })).toBeVisible();

  // Accepting twice fails because the invitation is gone
  expect(
    (await memberRequest.post(`/api/invitations/team/${team.id}`)).status(),
  ).toBe(404);
});

test("join link: outsider joins as incrementer, rotated link invalidates old token", async ({
  browser,
}) => {
  const team = await seedTeam();
  const ownerRequest = await requestAs(browser, owner);
  const outsiderRequest = await requestAs(browser, outsider);
  const memberRequest = await requestAs(browser, member);

  const enable = await ownerRequest.post(`/api/teams/${team.id}/join-link`);
  expect(enable.status()).toBe(200);
  const { token: oldToken } = await enable.json();
  expect(oldToken).toBeTruthy();

  const setRole = await ownerRequest.patch(`/api/teams/${team.id}/join-link`, {
    data: { role: "incrementer" },
  });
  expect(setRole.status()).toBe(200);

  // Non-managers can't touch the join link
  expect(
    (await outsiderRequest.post(`/api/teams/${team.id}/join-link`)).status(),
  ).toBe(404);

  const join = await outsiderRequest.post(`/api/teams/${team.id}/join`, {
    data: { token: oldToken },
  });
  expect(join.status()).toBe(200);
  expect(await join.json()).toMatchObject({ alreadyMember: false });
  expect(await getRole(team.id, outsider.id)).toBe("incrementer");

  const rotate = await ownerRequest.post(`/api/teams/${team.id}/join-link`);
  expect(rotate.status()).toBe(200);
  const { token: newToken } = await rotate.json();
  expect(newToken).not.toBe(oldToken);

  const staleJoin = await memberRequest.post(`/api/teams/${team.id}/join`, {
    data: { token: oldToken },
  });
  expect(staleJoin.status()).toBe(404);
  expect(await getRole(team.id, member.id)).toBeNull();

  const freshJoin = await memberRequest.post(`/api/teams/${team.id}/join`, {
    data: { token: newToken },
  });
  expect(freshJoin.status()).toBe(200);
  expect(await getRole(team.id, member.id)).toBe("incrementer");
});

test("admin cannot promote to owner, last owner cannot leave", async ({
  browser,
}) => {
  const admin = member;
  const team = await seedTeam([
    [admin, "admin"],
    [outsider, "viewer"],
  ]);
  const adminRequest = await requestAs(browser, admin);
  const ownerRequest = await requestAs(browser, owner);

  const promoteOther = await adminRequest.patch(
    `/t/${team.id}/members/${outsider.id}`,
    { data: { role: "owner" } },
  );
  expect(promoteOther.status()).toBe(403);

  const promoteSelf = await adminRequest.patch(
    `/t/${team.id}/members/${admin.id}`,
    { data: { role: "owner" } },
  );
  expect(promoteSelf.status()).toBe(403);
  expect(await getRole(team.id, outsider.id)).toBe("viewer");
  expect(await getRole(team.id, admin.id)).toBe("admin");

  // Admin may still change non-owner roles
  const promoteToEditor = await adminRequest.patch(
    `/t/${team.id}/members/${outsider.id}`,
    { data: { role: "editor" } },
  );
  expect(promoteToEditor.status()).toBe(200);

  const leave = await ownerRequest.delete(`/t/${team.id}/members/${owner.id}`);
  expect(leave.status()).toBe(409);
  expect(await getRole(team.id, owner.id)).toBe("owner");
});

test("transfer: moving a personal counter into a team grants access, moving it back revokes it", async ({
  browser,
}) => {
  const team = await seedTeam([[member, "viewer"]]);
  const counter = await seedPrivateCounter({ ownerId: owner.id });
  const ownerRequest = await requestAs(browser, owner);
  const memberRequest = await requestAs(browser, member);

  expect((await memberRequest.get(`/c/${counter.id}`)).status()).toBe(404);

  const toTeam = await ownerRequest.post(
    `/api/counters/${counter.id}/transfer`,
    { data: { teamId: team.id } },
  );
  expect(toTeam.status()).toBe(200);
  const [moved] = await db
    .select({ teamId: counters.teamId })
    .from(counters)
    .where(eq(counters.id, counter.id));
  expect(moved.teamId).toBe(team.id);

  expect((await memberRequest.get(`/c/${counter.id}`)).status()).toBe(200);

  // A viewer can't move the counter out of the team
  expect(
    (
      await memberRequest.post(`/api/counters/${counter.id}/transfer`, {
        data: { teamId: null },
      })
    ).status(),
  ).toBe(403);

  const toPersonal = await ownerRequest.post(
    `/api/counters/${counter.id}/transfer`,
    { data: { teamId: null } },
  );
  expect(toPersonal.status()).toBe(200);
  const [back] = await db
    .select({ teamId: counters.teamId, ownerId: counters.ownerId })
    .from(counters)
    .where(eq(counters.id, counter.id));
  expect(back).toEqual({ teamId: null, ownerId: owner.id });

  expect((await memberRequest.get(`/c/${counter.id}`)).status()).toBe(404);
});

test("team deletion requires the exact name and removes team counters", async ({
  browser,
}) => {
  const team = await seedTeam([[member, "admin"]]);
  const counter = await seedPrivateCounter({ teamId: team.id });
  const ownerRequest = await requestAs(browser, owner);
  const adminRequest = await requestAs(browser, member);

  const wrongName = await ownerRequest.delete(`/api/teams/${team.id}`, {
    data: { confirmName: `${team.name} nope` },
  });
  expect(wrongName.status()).toBe(400);

  // Only owners may delete
  const byAdmin = await adminRequest.delete(`/api/teams/${team.id}`, {
    data: { confirmName: team.name },
  });
  expect(byAdmin.status()).toBe(403);

  expect(
    await db.select({ id: teams.id }).from(teams).where(eq(teams.id, team.id)),
  ).toHaveLength(1);

  const deleted = await ownerRequest.delete(`/api/teams/${team.id}`, {
    data: { confirmName: team.name },
  });
  expect(deleted.status()).toBe(200);
  expect(await deleted.json()).toMatchObject({
    success: true,
    counterIds: [counter.id],
  });

  expect(
    await db.select({ id: teams.id }).from(teams).where(eq(teams.id, team.id)),
  ).toHaveLength(0);
  expect(
    await db
      .select({ id: counters.id })
      .from(counters)
      .where(eq(counters.id, counter.id)),
  ).toHaveLength(0);
  expect(
    await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id)),
  ).toHaveLength(0);
});

test("UI: create a team from /my/teams and land on the team page", async ({
  context,
  page,
}) => {
  await authenticate(context, owner);
  const teamName = `E2E UI Team ${Math.random().toString(16).slice(2, 8)}`;

  await page.goto("/my/teams");
  await page.getByRole("button", { name: "Create team" }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Empty name shows a validation error
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(dialog.getByText("Name is required")).toBeVisible();

  await dialog.getByLabel("Name", { exact: true }).fill(teamName);
  await dialog.getByRole("button", { name: "Create team" }).click();

  await expect(page).toHaveURL(/\/t\/[0-9a-f-]{36}\/e2e-ui-team-/);
  const teamId = new URL(page.url()).pathname.split("/")[2];
  teamIds.push(teamId);

  await expect(
    page.getByRole("heading", { level: 1, name: teamName }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Counters/ })).toBeVisible();
  expect(await getRole(teamId, owner.id)).toBe("owner");
});
