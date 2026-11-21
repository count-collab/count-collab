import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  permissions,
  rolePermissions,
  roles,
  teamInvitations,
  teams,
  users,
} from "../src/lib/db/schema";
import {
  authenticate,
  createTestUser,
  deleteTeams,
  deleteUsers,
  type TestUser,
} from "./auth-helpers";

test("mobile navigation keeps primary actions visible and supports keyboard dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/counters");
  await page.locator("#svelte-announcer").waitFor({ state: "attached" });

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const menu = nav.getByRole("button", { name: "Toggle menu" });
  await expect(nav.getByRole("link", { name: "Create counter" })).toBeVisible();
  const menuBounds = await menu.boundingBox();
  expect(menuBounds?.width).toBeGreaterThanOrEqual(44);
  expect(menuBounds?.height).toBeGreaterThanOrEqual(44);
  expect(
    await nav.evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await expect(nav.getByRole("button", { name: /Theme:/ })).toHaveCount(0);

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "Counters", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(nav.locator('a[href="/create"]:visible')).toHaveCount(1);
  const theme = nav.getByRole("button", { name: /Theme:/ });
  await expect(theme).toBeVisible();
  const previousTheme = await theme.getAttribute("aria-label");
  await theme.click();
  await expect(theme).not.toHaveAttribute("aria-label", previousTheme ?? "");

  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  await menu.click();
  await page.mouse.click(10, 620);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});

test.describe("signed-in navigation", () => {
  let user: TestUser;
  let createdRoleId: number | undefined;
  let createdPermissionId: number | undefined;
  const teamIds: string[] = [];

  test.beforeEach(async ({ context }) => {
    user = await createTestUser("navigation");
    await authenticate(context, user);
  });

  test.afterEach(async () => {
    await deleteTeams(teamIds);
    teamIds.length = 0;
    await deleteUsers([user]);
    if (createdRoleId !== undefined) {
      await db.delete(roles).where(eq(roles.id, createdRoleId));
      createdRoleId = undefined;
    }
    if (createdPermissionId !== undefined) {
      await db
        .delete(permissions)
        .where(eq(permissions.id, createdPermissionId));
      createdPermissionId = undefined;
    }
  });

  test("keeps invitation notifications and account links in the mobile menu", async ({
    page,
  }) => {
    const [team] = await db
      .insert(teams)
      .values({ name: "Navigation test team", createdBy: user.id })
      .returning({ id: teams.id });
    teamIds.push(team.id);
    await db
      .insert(teamInvitations)
      .values({ teamId: team.id, userId: user.id });

    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/counters");
    await page.locator("#svelte-announcer").waitFor({ state: "attached" });
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const menu = nav.getByRole("button", { name: "Toggle menu" });
    await expect(menu).toHaveAccessibleDescription("1 pending invitation");
    await expect(nav.getByRole("link", { name: /Invitations/ })).toHaveCount(0);
    await menu.click();
    await expect(nav.getByText("Account", { exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Invitations/ })).toContainText(
      "1 pending",
    );
    await expect(nav.locator('#mobile-navigation a[href="/my"]')).toHaveCount(
      1,
    );
    await expect(nav.getByRole("link", { name: "Teams" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("shows admin navigation and opens the desktop account menu by keyboard", async ({
    page,
  }) => {
    const [newPermission] = await db
      .insert(permissions)
      .values({ name: "user:manage" })
      .onConflictDoNothing()
      .returning({ id: permissions.id });
    createdPermissionId = newPermission?.id;
    const [permission] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.name, "user:manage"))
      .limit(1);
    const [adminRole] = await db
      .insert(roles)
      .values({ name: `navigation-admin-${user.id}` })
      .returning({ id: roles.id });
    createdRoleId = adminRole.id;
    await db.insert(rolePermissions).values({
      roleId: adminRole.id,
      permissionId: permission.id,
    });
    await db
      .update(users)
      .set({ roleId: adminRole.id })
      .where(eq(users.id, user.id));

    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/counters");
    await page.locator("#svelte-announcer").waitFor({ state: "attached" });
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await nav.getByRole("button", { name: "Toggle menu" }).click();
    await expect(nav.getByRole("link", { name: "Admin" })).toBeVisible();
    const theme = nav.getByRole("button", { name: /Theme:/ });
    await theme.scrollIntoViewIfNeeded();
    await expect(theme).toBeInViewport();

    await page.setViewportSize({ width: 1200, height: 800 });
    const account = nav.getByRole("button", { name: user.username });
    await account.focus();
    await page.keyboard.press("Enter");
    await expect(account).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "Admin" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(account).toHaveAttribute("aria-expanded", "false");
    await expect(account).toBeFocused();
  });
});
