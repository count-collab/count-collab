import { expect, test } from "@playwright/test";

test.describe("Teams marketing page", () => {
  test("explains teams and directs visitors through sign-in to team creation", async ({
    page,
  }) => {
    await page.goto("/teams");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Count together. Stay on the same page.",
      }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/teams$/,
    );
    await expect(
      page.getByRole("heading", { name: "The right role for the work." }),
    ).toBeVisible();
    await page.getByText("Does everyone need an account?").click();
    await expect(page.getByText(/team members need to sign in/)).toBeVisible();
    await page.getByText("How many people can join a team?").click();
    await expect(page.getByText(/up to 100 members/)).toBeVisible();

    const create = page.getByRole("link", { name: "Create a team" }).first();
    await expect(create).toHaveAttribute(
      "href",
      "/login?redirectTo=%2Fcreate%3Ftype%3Dteam",
    );
    await create.click();
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcreate%3Ftype%3Dteam/);
  });

  test("is discoverable from features and works on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/features");
    await page.getByRole("link", { name: "Explore Teams" }).click();
    await expect(page).toHaveURL(/\/teams$/);
    await expect(
      page.getByRole("link", { name: "Create a team" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Whatever you're counting, count it together.",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("illustrates the team counters view at desktop and mobile sizes", async ({
    page,
  }) => {
    await page.goto("/teams");
    const example = page.locator(".workspace");
    await expect(example.getByText("Operations team")).toBeVisible();
    await expect(example.locator(".workspace-tab")).toHaveText([
      " Counters 3",
      " Dashboards 1",
      " Members 3",
    ]);
    await expect(example.locator(".workspace-tab-active")).toContainText(
      "Counters",
    );
    await expect(example.locator(".workspace-card")).toHaveCount(3);
    await expect(example).toContainText("Inspections completed");
    await expect(example).toContainText("Deliveries received");
    await expect(example).toContainText("Customer visits");

    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await example.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  });
});
