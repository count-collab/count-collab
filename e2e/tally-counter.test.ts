import { expect, test } from "@playwright/test";

test.describe("Tally counter landing page", () => {
  test("shows the tally counter introduction and create action", async ({
    page,
  }) => {
    await page.goto("/tally-counter");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "A tally counter for counting together",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create a tally counter" }).first(),
    ).toHaveAttribute("href", "/create?type=counter");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/tally-counter$/,
    );
  });

  test("links from use cases to the tally counter page", async ({ page }) => {
    await page.goto("/use-cases");

    await expect(
      page.getByRole("heading", { name: "Online Tally Counter" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore the online tally counter" }),
    ).toHaveAttribute("href", "/tally-counter");
  });
});
