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
    const countingSection = page.getByRole("region", {
      name: "A simple tally, useful anywhere Create, share, count",
    });
    await expect(countingSection).toBeVisible();
    await expect(
      countingSection.getByRole("heading", {
        name: "A simple tally, useful anywhere",
      }),
    ).toBeVisible();
    await expect(
      countingSection.getByRole("heading", {
        name: "Create, share, count",
      }),
    ).toBeVisible();
    for (const section of await page
      .getByRole("main")
      .locator("section")
      .all()) {
      await expect(section).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(section).toHaveCSS("border-top-width", "0px");
      await expect(section).toHaveCSS("border-bottom-width", "0px");
    }
    await expect(
      page.getByRole("link", { name: "Create a tally counter" }).first(),
    ).toHaveAttribute("href", "/create?type=counter");
    const headerAction = page
      .getByRole("link", {
        name: "Get Started",
        exact: true,
      })
      .first();
    const brandBlue = await headerAction.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    for (const action of await page
      .getByRole("link", {
        name: "Create a tally counter",
        exact: true,
      })
      .all()) {
      await expect(action).toHaveCSS("background-color", brandBlue);
    }
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/tally-counter$/,
    );
    await expect(
      page.getByRole("heading", {
        name: "From clickers and tally sheets to one shared count",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Chrome hand tally counter with four rolling number wheels",
      }),
    ).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /tally clicker or paper tally/,
    );
  });

  test("automatically increments the illustrative clicker", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/tally-counter");

    const clicker = page.getByTestId("tally-clicker");
    await expect(clicker).toHaveAttribute("data-count", "0042");
    await expect(clicker).toHaveAttribute("data-count", "0043", {
      timeout: 5000,
    });
  });

  test("keeps the clicker static for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/tally-counter");

    const clicker = page.getByTestId("tally-clicker");
    await expect(clicker).toHaveAttribute("data-count", "0042");
    await page.waitForTimeout(2300);
    await expect(clicker).toHaveAttribute("data-count", "0042");
  });

  test("links from use cases to the tally counter page", async ({ page }) => {
    await page.goto("/use-cases");

    await expect(
      page.getByRole("heading", { name: "Inventory & Stock Tracking" }),
    ).toHaveCount(0);
    await expect(page.getByRole("main")).not.toContainText(/inventory/i);
    await expect(page.locator('meta[name="description"]')).not.toHaveAttribute(
      "content",
      /inventory/i,
    );
    await expect(
      page.getByRole("heading", { name: "Online Tally Counter" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore the online tally counter" }),
    ).toHaveAttribute("href", "/tally-counter");
    await expect(
      page.getByRole("navigation").locator('a[href="/tally-counter"]'),
    ).toHaveCount(0);
    await expect(
      page.getByRole("contentinfo").locator('a[href="/tally-counter"]'),
    ).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Toggle menu" }).click();
    await expect(
      page.getByRole("link", { name: "Use Cases", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").locator('a[href="/tally-counter"]'),
    ).toHaveCount(0);
  });
});
