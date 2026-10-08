import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  counters,
  dashboardItems,
  dashboards,
  teamMembers,
  teams,
} from "../src/lib/db/schema";
import {
  createTestUser,
  deleteCounters,
  deleteTeams,
  deleteUsers,
  newAuthedContext,
  type TestUser,
} from "./auth-helpers";

let owner: TestUser;
let teamIds: string[];
let counterIds: string[];
let dashboardIds: string[];
let contexts: BrowserContext[];

test.beforeEach(async () => {
  teamIds = [];
  counterIds = [];
  dashboardIds = [];
  contexts = [];
  owner = await createTestUser("dash");
});

test.afterEach(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  if (dashboardIds.length > 0) {
    await db.delete(dashboards).where(inArray(dashboards.id, dashboardIds));
  }
  await deleteCounters(counterIds);
  await deleteTeams(teamIds);
  await deleteUsers([owner]);
});

function randomSuffix(): string {
  return Math.random().toString(16).slice(2, 8);
}

async function seedTeam(): Promise<{ id: string; name: string }> {
  const name = `E2E Team ${randomSuffix()}`;
  const [team] = await db
    .insert(teams)
    .values({ name, createdBy: owner.id })
    .returning({ id: teams.id });
  teamIds.push(team.id);
  await db
    .insert(teamMembers)
    .values({ teamId: team.id, userId: owner.id, role: "owner" });
  return { id: team.id, name };
}

async function seedCounter(
  label: string,
  values: { teamId?: string } = {},
): Promise<{ id: string; title: string }> {
  const title = `E2E ${label} ${randomSuffix()}`;
  const [counter] = await db
    .insert(counters)
    .values({
      title,
      visibilityMode: "private",
      isPublic: 0,
      ownerId: owner.id,
      ...values,
    })
    .returning({ id: counters.id });
  counterIds.push(counter.id);
  return { id: counter.id, title };
}

async function seedDashboard(itemCounterIds: string[] = []): Promise<string> {
  const [dashboard] = await db
    .insert(dashboards)
    .values({
      title: `E2E Dashboard ${randomSuffix()}`,
      ownerId: owner.id,
    })
    .returning({ id: dashboards.id });
  dashboardIds.push(dashboard.id);
  if (itemCounterIds.length > 0) {
    await db.insert(dashboardItems).values(
      itemCounterIds.map((counterId, i) => ({
        dashboardId: dashboard.id,
        counterId,
        positionX: i,
      })),
    );
  }
  return dashboard.id;
}

// SvelteKit renders its route announcer only after the client app has mounted
async function waitForHydration(page: Page): Promise<void> {
  await page.locator("#svelte-announcer").waitFor({ state: "attached" });
}

async function openDashboard(
  browser: Browser,
  dashboardId: string,
): Promise<Page> {
  const context = await newAuthedContext(browser, owner);
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(`/d/${dashboardId}`);
  await waitForHydration(page);
  return page;
}

async function openAddCounter(page: Page): Promise<Locator> {
  // Empty dashboards expose the trigger directly; it also enables edit mode
  await page.getByRole("button", { name: "Add Counter" }).click();
  const overlay = page.getByRole("dialog", { name: "Add Counter" });
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText("Loading counters…")).toBeHidden();
  return overlay;
}

test("Add Counter overlay: owner adds a counter, overlay stays open, Done shows it on the dashboard", async ({
  browser,
}) => {
  const counter = await seedCounter("Personal");
  const dashboardId = await seedDashboard();
  const page = await openDashboard(browser, dashboardId);

  const overlay = await openAddCounter(page);
  await expect(overlay.getByPlaceholder("Search counters…")).toBeFocused();
  await expect(overlay.getByRole("heading", { name: "Popular" })).toBeVisible();

  const mine = overlay.getByRole("region", { name: "Your Counters" });
  await expect(mine.getByText(counter.title)).toBeVisible();
  // No team counters, so the owner filter is not rendered
  await expect(
    overlay.getByRole("group", { name: "Filter by owner" }),
  ).toBeHidden();

  await mine.getByRole("button", { name: `Add ${counter.title}` }).click();
  await expect(mine.getByText("Added", { exact: true })).toBeVisible();
  await expect(overlay.getByText("1 added")).toBeVisible();
  await expect(overlay).toBeVisible();

  await overlay.getByRole("button", { name: "Done" }).click();
  await expect(overlay).toBeHidden();
  await expect(
    page.locator(".dashboard-grid").getByRole("link", { name: counter.title }),
  ).toBeVisible();
});

test("Add Counter overlay: search with no matches shows empty states", async ({
  browser,
}) => {
  const counter = await seedCounter("Searchable");
  const dashboardId = await seedDashboard();
  const page = await openDashboard(browser, dashboardId);

  const overlay = await openAddCounter(page);
  const mine = overlay.getByRole("region", { name: "Your Counters" });
  await expect(mine.getByText(counter.title)).toBeVisible();

  await overlay
    .getByPlaceholder("Search counters…")
    .fill(`no-match-${randomSuffix()}-${randomSuffix()}`);
  await expect(
    mine.getByText("None of your counters match this search."),
  ).toBeVisible();
  await expect(
    overlay.getByRole("heading", { name: "Other Counters" }),
  ).toBeVisible();
  await expect(
    overlay.getByText("No other counters match this search."),
  ).toBeVisible();

  await overlay.getByPlaceholder("Search counters…").fill(counter.title);
  await expect(
    mine.getByRole("button", { name: `Add ${counter.title}` }),
  ).toBeVisible();
});

test("Add Counter overlay: owner filter separates personal and team counters", async ({
  browser,
}) => {
  const team = await seedTeam();
  const personal = await seedCounter("Personal");
  const teamCounter = await seedCounter("Team", { teamId: team.id });
  const dashboardId = await seedDashboard();
  const page = await openDashboard(browser, dashboardId);

  const overlay = await openAddCounter(page);
  const mine = overlay.getByRole("region", { name: "Your Counters" });
  await expect(mine.getByText(personal.title)).toBeVisible();
  await expect(mine.getByText(teamCounter.title)).toBeVisible();

  const filter = mine.getByRole("group", { name: "Filter by owner" });
  const allButton = filter.getByRole("button", { name: "All", exact: true });
  const personalButton = filter.getByRole("button", {
    name: "Personal",
    exact: true,
  });
  const teamButton = filter.getByRole("button", {
    name: team.name,
    exact: true,
  });
  await expect(allButton).toHaveAttribute("aria-pressed", "true");

  await personalButton.click();
  await expect(personalButton).toHaveAttribute("aria-pressed", "true");
  await expect(mine.getByText(personal.title)).toBeVisible();
  await expect(mine.getByText(teamCounter.title)).toBeHidden();

  await teamButton.click();
  await expect(teamButton).toHaveAttribute("aria-pressed", "true");
  await expect(mine.getByText(teamCounter.title)).toBeVisible();
  await expect(mine.getByText(personal.title)).toBeHidden();

  await allButton.click();
  await expect(mine.getByText(personal.title)).toBeVisible();
  await expect(mine.getByText(teamCounter.title)).toBeVisible();
});

test("Dashboard Settings: choosing 3 columns persists and drives the grid", async ({
  browser,
}) => {
  const counter = await seedCounter("Grid");
  const dashboardId = await seedDashboard([counter.id]);
  const page = await openDashboard(browser, dashboardId);

  const grid = page.locator(".dashboard-grid");
  await expect(grid).toHaveAttribute("style", /--grid-cols: 5;/);

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Dashboard Settings" });
  await expect(settings).toBeVisible();

  const columns = settings.getByRole("radiogroup", { name: "Columns" });
  await expect(columns.getByRole("radio")).toHaveCount(4);
  await expect(
    columns.getByRole("radio", { name: "5 columns" }),
  ).toHaveAttribute("aria-checked", "true");

  const three = columns.getByRole("radio", { name: "3 columns" });
  await three.click();
  await expect(three).toHaveAttribute("aria-checked", "true");

  const patch = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/dashboards/${dashboardId}`) &&
      r.request().method() === "PATCH",
  );
  await settings.getByRole("button", { name: "Save changes" }).click();
  expect((await patch).status()).toBe(200);
  await expect(settings).toBeHidden();

  await expect(grid).toHaveAttribute("style", /--grid-cols: 3;/);
  await expect
    .poll(() =>
      grid.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      ),
    )
    .toBe(3);

  const [stored] = await db
    .select({ gridColumns: dashboards.gridColumns })
    .from(dashboards)
    .where(eq(dashboards.id, dashboardId));
  expect(stored.gridColumns).toBe(3);

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(settings).toBeVisible();
  await expect(three).toHaveAttribute("aria-checked", "true");
  await expect(
    columns.getByRole("radio", { name: "5 columns" }),
  ).toHaveAttribute("aria-checked", "false");
});
