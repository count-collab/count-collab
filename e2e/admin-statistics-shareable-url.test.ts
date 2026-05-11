import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  permissions,
  platformEvents,
  rolePermissions,
  roles,
  sessions,
  users,
} from "../src/lib/db/schema";

test("admin statistics URL is shareable and restores state", async ({
  context,
  page,
}) => {
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userId = `e2e-admin-${runId}`;
  const username = `e2e_admin_${Date.now()}`;
  const email = `${userId}@example.com`;
  const roleName = `e2e-admin-role-${runId}`;
  const sessionToken = `e2e-admin-session-${runId}`;
  const permissionName = "user:manage";
  const eventEntityId = crypto.randomUUID();

  let roleId: number | null = null;
  let permissionId: number | null = null;
  let createdPermission = false;

  try {
    const [existingPermission] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.name, permissionName))
      .limit(1);

    if (existingPermission) {
      permissionId = existingPermission.id;
    } else {
      const [insertedPermission] = await db
        .insert(permissions)
        .values({
          name: permissionName,
          description: "E2E admin permission",
        })
        .returning({ id: permissions.id });

      permissionId = insertedPermission.id;
      createdPermission = true;
    }

    const [insertedRole] = await db
      .insert(roles)
      .values({
        name: roleName,
        description: "E2E admin role",
      })
      .returning({ id: roles.id });

    roleId = insertedRole.id;

    await db.insert(rolePermissions).values({
      roleId,
      permissionId,
    });

    await db.insert(users).values({
      id: userId,
      name: "E2E Admin",
      email,
      username,
      roleId,
    });

    await db.insert(sessions).values({
      sessionToken,
      userId,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    });

    await db.insert(platformEvents).values({
      eventType: "counter_action",
      userId,
      entityId: eventEntityId,
      entityType: "counter",
      metadata: {},
      createdAt: new Date(),
    });

    await context.addCookies([
      {
        name: "authjs.session-token",
        value: sessionToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/admin/statistics");
    await expect(page.getByRole("heading", { name: "Metrics" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Event Log" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /counter_action/i }).first(),
    ).toBeVisible();

    const past30DaysButton = page.getByRole("button", { name: "Past 30 days" });
    const past7DaysButton = page.getByRole("button", { name: "Past 7 days" });

    await expect(past30DaysButton).toHaveAttribute("aria-pressed", "true");
    await expect(past7DaysButton).toHaveAttribute("aria-pressed", "false");

    await past7DaysButton.click();

    await expect(past7DaysButton).toHaveAttribute("aria-pressed", "true");

    await expect
      .poll(() => new URL(page.url()).searchParams.get("timeframe"))
      .toBe("7d");

    await page
      .getByRole("button", { name: /counter_action/i })
      .first()
      .click();

    await page
      .getByTitle("Filter by Event Type: counter_action")
      .first()
      .click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get("timeframe"))
      .toBe("7d");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("filter.eventType"))
      .toBe("counter_action");

    const shareableUrl = page.url();

    await page.reload();

    await expect(page).toHaveURL(shareableUrl);
    await expect(
      page.getByRole("button", { name: "Past 7 days" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page
        .locator("button", { hasText: "Event Type:" })
        .filter({ hasText: "counter_action" })
        .first(),
    ).toBeVisible();
  } finally {
    await db
      .delete(platformEvents)
      .where(
        and(
          eq(platformEvents.userId, userId),
          eq(platformEvents.entityId, eventEntityId),
        ),
      );

    await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
    await db.delete(users).where(eq(users.id, userId));

    if (roleId !== null) {
      await db
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));
      await db.delete(roles).where(eq(roles.id, roleId));
    }

    if (createdPermission && permissionId !== null) {
      await db.delete(permissions).where(eq(permissions.id, permissionId));
    }
  }
});
