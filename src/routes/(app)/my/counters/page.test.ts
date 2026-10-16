import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return {
    page: readable({
      data: { session: { user: { id: "user-1" } } },
      url: new URL("http://localhost/my/counters"),
    }),
  };
});

vi.mock("$app/environment", () => ({
  browser: false,
}));

vi.mock("$lib/stores/counters", () => ({
  onCounterUpdated: () => () => {},
}));

const { default: Page } = await import("./+page.svelte");

function counter(overrides: Record<string, unknown> = {}) {
  return {
    id: "counter-1",
    title: "Personal Counter",
    description: null,
    count: 1,
    isPublic: true,
    visibilityMode: "public",
    ownerId: "user-1",
    teamId: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-02T00:00:00.000Z",
    shareToken: null,
    ...overrides,
  };
}

function renderPage() {
  const data = {
    ownedCounters: { items: [counter()], total: 40 },
    sharedCounters: {
      items: [
        counter({
          id: "shared-1",
          title: "Team Counter",
          ownerId: "user-2",
          teamId: "team-1",
          teamName: "Alpha",
          memberRole: "editor",
        }),
        counter({
          id: "shared-2",
          title: "Direct Share",
          ownerId: "user-3",
          memberRole: "viewer",
        }),
      ],
      total: 2,
    },
    followedCounters: [],
    page: 1,
    totalPages: 3,
  };
  return render(Page, { props: { data } as never });
}

function badgeFor(heading: string) {
  return screen
    .getByRole("heading", { name: heading })
    .nextElementSibling?.textContent?.trim();
}

async function selectFilter(name: string) {
  const group = screen.getByRole("group", { name: "Filter by owner" });
  await fireEvent.click(within(group).getByRole("button", { name }));
}

describe("My counters page owner filter", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows full totals and pagination with no filter", () => {
    renderPage();

    expect(badgeFor("Owned")).toBe("40");
    expect(badgeFor("Shared with me")).toBe("2");
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeTruthy();
  });

  it("hides owned counters and pagination when a team filter is selected", async () => {
    renderPage();

    await selectFilter("Alpha");

    expect(badgeFor("Owned")).toBe("0");
    expect(
      screen.getByText("No owned counters match this filter."),
    ).toBeTruthy();
    expect(screen.queryByText("Personal Counter")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
    expect(badgeFor("Shared with me")).toBe("1");
  });

  it("keeps owned counters and pagination with the Personal filter", async () => {
    renderPage();

    await selectFilter("Personal");

    expect(badgeFor("Owned")).toBe("40");
    expect(screen.getByText("Personal Counter")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeTruthy();
    expect(badgeFor("Shared with me")).toBe("1");
  });
});
