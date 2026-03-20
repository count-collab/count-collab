import { expect, test } from "@playwright/test";

test.describe("Homepage", () => {
  test("should display the welcome heading", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Welcome to Count Collab" }),
    ).toBeVisible();
  });

  test("should have a Create Counter link", async ({ page }) => {
    await page.goto("/");

    const createLink = page.getByRole("link", { name: "Create Counter" });
    await expect(createLink).toBeVisible();
    await expect(createLink).toHaveAttribute("href", "/create");
  });

  test("should have a Browse Counters link", async ({ page }) => {
    await page.goto("/");

    const browseLink = page.getByRole("link", { name: "Browse Counters" });
    await expect(browseLink).toBeVisible();
    await expect(browseLink).toHaveAttribute("href", "/counters");
  });
});
