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
    await expect(
      page.getByRole("link", { name: "Create a tally counter" }).first(),
    ).toHaveCSS("background-color", brandBlue);
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

  test("matches Teams page heading and section label styles", async ({
    page,
  }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: "dark" });

      async function styles(label: string, heading: string) {
        const typography = (element: Element) => {
          const style = getComputedStyle(element);
          return {
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing,
            color: style.color,
          };
        };
        const eyebrow = page.getByText(label, { exact: true });
        return {
          hero: await page
            .getByRole("main")
            .getByRole("heading", { level: 1 })
            .evaluate(typography),
          heading: await page
            .getByRole("heading", { name: heading })
            .evaluate(typography),
          label: await eyebrow.evaluate(typography),
          lineWidth: await eyebrow
            .locator("span")
            .evaluate((line) => getComputedStyle(line).width),
        };
      }

      await page.goto("/teams");
      await page.locator("#svelte-announcer").waitFor({ state: "attached" });
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      const teamStyles = await styles(
        "A better way to share",
        "Less sharing links. More getting things done.",
      );
      await page.goto("/tally-counter");
      await page.locator("#svelte-announcer").waitFor({ state: "attached" });
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      const tallyStyles = await styles(
        "One count, shared",
        "From clickers and tally sheets to one shared count",
      );
      expect(tallyStyles).toEqual(teamStyles);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });

  test("starts hero content at the same height as Teams", async ({ page }) => {
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/teams");
      const teamTop = await page
        .getByText("Count Collab / Teams")
        .evaluate((label) => {
          const section = label.closest("section");
          if (!section) throw new Error("Hero section not found");
          return (
            label.getBoundingClientRect().top -
            section.getBoundingClientRect().top
          );
        });

      await page.goto("/tally-counter");
      const tallyTop = await page
        .getByText("Count Collab / Online tally")
        .evaluate((label) => {
          const section = label.closest("section");
          if (!section) throw new Error("Hero section not found");
          return (
            label.getBoundingClientRect().top -
            section.getBoundingClientRect().top
          );
        });
      expect(tallyTop).toBeCloseTo(teamTop, 0);
    }
  });

  test("uses the Teams call-to-action design for tally counters", async ({
    page,
  }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/teams");
      const teamPanel = page.locator(".cta-panel");
      const teamBackground = await teamPanel.evaluate(
        (element) => getComputedStyle(element).backgroundImage,
      );
      expect(teamBackground).toContain("linear-gradient");

      await page.goto("/tally-counter");
      const tallyPanel = page.locator(".cta-panel");
      await expect(
        tallyPanel.getByRole("heading", {
          name: "Make the count a team effort.",
        }),
      ).toBeVisible();
      await expect(
        tallyPanel.getByRole("link", { name: "Create a tally counter" }),
      ).toHaveAttribute("href", "/create?type=counter");
      await expect(tallyPanel).toHaveCSS("background-image", teamBackground);
      await expect(
        tallyPanel.getByRole("link", { name: "Create a tally counter" }),
      ).toHaveCSS("background-color", "rgb(255, 255, 255)");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });

  test("keeps each page's use cases and setup steps", async ({ page }) => {
    const pages = [
      {
        path: "/tally-counter",
        headings: [
          "Events and attendance",
          "Classroom participation",
          "Team goals and collections",
          "Name your counter",
          "Share one link",
          "Watch it update",
        ],
      },
      {
        path: "/teams",
        headings: [
          "Keep work in view",
          "See every entrance",
          "Make progress visible",
          "Make a space",
          "Bring your people",
          "Bring your counts",
          "Count together",
        ],
      },
    ];

    for (const { path, headings } of pages) {
      await page.goto(path);
      for (const heading of headings) {
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
      }
    }
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
