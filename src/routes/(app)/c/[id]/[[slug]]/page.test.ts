import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock SvelteKit modules
vi.mock("$app/environment", () => ({ browser: false }));
vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return {
    page: readable({
      url: new URL("http://localhost/c/test-counter-id/test-counter"),
    }),
  };
});

// Mock stores
vi.mock("$lib/stores/counters", () => ({
  onCounterUpdated: vi.fn(() => () => {}),
}));
vi.mock("$lib/stores/ratelimit", async () => {
  const { readable } = await import("svelte/store");
  return {
    rateLimit: readable({ isLimited: false, retryAfterSeconds: 0 }),
  };
});

// Stub global fetch for Sparkline
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })),
);

// Import after mocks
const { default: Page } = await import("./+page.svelte");

function makePageData(overrides: Record<string, unknown> = {}) {
  return {
    counter: {
      id: "test-counter-id",
      title: "Test Counter",
      description: "A test counter",
      count: 42,
      isPublic: true,
      visibilityMode: "public",
      counterMode: "increment_only",
      ownerId: "owner-1",
      createdAt: "2025-06-15T10:30:00.000Z",
      updatedAt: "2026-03-20T14:00:00.000Z",
      lastActivityAt: "2026-03-20T14:00:00.000Z",
      shareToken: null,
    },
    history: [],
    canEdit: false,
    canDelete: false,
    canManage: false,
    canIncrement: true,
    isOwner: false,
    isMember: false,
    isFollowing: false,
    followerCount: 0,
    ownerUsername: null,
    members: [],
    shareToken: null,
    hasValidToken: false,
    autoDeleteInfo: null,
    title: "Test Counter | Count Collab",
    description: "A test counter",
    ...overrides,
  };
}

describe("Counter detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("displays the counter title", () => {
    const { container } = render(Page, {
      props: { data: makePageData() as never },
    });
    expect(container.textContent).toContain("Test Counter");
  });

  it("displays the created-at date", () => {
    const { container } = render(Page, {
      props: { data: makePageData() as never },
    });
    const text = container.textContent ?? "";
    const expectedDate = new Date(
      "2025-06-15T10:30:00.000Z",
    ).toLocaleDateString();
    expect(text).toContain(`Created  ${expectedDate}`);
  });

  it("displays the updated-at datetime", () => {
    const { container } = render(Page, {
      props: { data: makePageData() as never },
    });
    const text = container.textContent ?? "";
    const expectedDateTime = new Date(
      "2026-03-20T14:00:00.000Z",
    ).toLocaleString();
    expect(text).toContain(`Updated ${expectedDateTime}`);
  });

  it("shows Public tag for public counters", () => {
    const { container } = render(Page, {
      props: { data: makePageData() as never },
    });
    expect(container.textContent).toContain("Public");
  });

  it("shows Private tag for private counters", () => {
    const { container } = render(Page, {
      props: {
        data: makePageData({
          counter: {
            ...makePageData().counter,
            visibilityMode: "private",
            isPublic: false,
          },
        }) as never,
      },
    });
    expect(container.textContent).toContain("Private");
  });

  it("shows separate Public and read-only badges", () => {
    render(Page, {
      props: {
        data: makePageData({
          counter: {
            ...makePageData().counter,
            visibilityMode: "public_readonly",
          },
          canIncrement: true,
        }) as never,
      },
    });

    expect(screen.getAllByText("Public").length).toBeGreaterThan(0);
    expect(screen.getAllByText("read-only").length).toBeGreaterThan(0);
  });

  it("disables increment controls and shows unavailable messaging when canIncrement is false", () => {
    render(Page, {
      props: {
        data: makePageData({
          counter: {
            ...makePageData().counter,
            visibilityMode: "public_readonly",
          },
          canIncrement: false,
        }) as never,
      },
    });

    const button = screen.getByRole("button", {
      name: "Increment counter",
    });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getAllByText(
        "Anyone can view. Only invited members can increment.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("renders the incrementer role label in the members list", async () => {
    render(Page, {
      props: {
        data: makePageData({
          canManage: true,
          members: [
            {
              id: "member-1",
              userId: "user-2",
              username: "alice",
              name: null,
              image: null,
              role: "incrementer",
            },
          ],
        }) as never,
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getAllByText("Incrementer").length).toBeGreaterThan(0);
  });

  it("closes the share modal when Escape is pressed", async () => {
    render(Page, {
      props: { data: makePageData({ canManage: true }) as never },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.getByRole("dialog", { name: "Share Counter" })).toBeTruthy();

    await fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Share Counter" })).toBeNull();
  });

  it("closes the delete confirmation modal when Escape is pressed", async () => {
    render(Page, {
      props: { data: makePageData({ canDelete: true }) as never },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      screen.getByRole("dialog", { name: "Delete Counter?" }),
    ).toBeTruthy();

    await fireEvent.keyDown(window, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Delete Counter?" }),
    ).toBeNull();
  });

  it("shows Owner tag when user is owner", () => {
    const { container } = render(Page, {
      props: { data: makePageData({ isOwner: true }) as never },
    });
    expect(container.textContent).toContain("Owner");
  });

  it("does not show Owner tag when user is not owner", () => {
    const { container } = render(Page, {
      props: { data: makePageData({ isOwner: false }) as never },
    });
    expect(container.textContent).not.toContain("Owner");
  });

  it("displays owner username when ownerUsername is provided", () => {
    const { container } = render(Page, {
      props: { data: makePageData({ ownerUsername: "janedoe" }) as never },
    });
    expect(container.textContent).toContain("by");
    expect(container.textContent).toContain("@janedoe");
  });

  it("does not display owner attribution when ownerUsername is null", () => {
    const { container } = render(Page, {
      props: { data: makePageData({ ownerUsername: null }) as never },
    });
    expect(container.textContent).not.toContain("by");
    expect(container.textContent).not.toContain("@");
  });

  it("does not show inactivity warning for owned counters", () => {
    const { container } = render(Page, {
      props: { data: makePageData({ autoDeleteInfo: null }) as never },
    });
    expect(container.textContent).not.toContain("Inactive");
    expect(container.textContent).not.toContain("auto-deletes");
  });

  it("does not show inactivity warning when counter is active", () => {
    const { container } = render(Page, {
      props: {
        data: makePageData({
          autoDeleteInfo: {
            inactiveDays: 3,
            daysUntilDeletion: 27,
            deletionDate: "2026-06-01T00:00:00.000Z",
            showWarning: false,
          },
        }) as never,
      },
    });
    expect(container.textContent).not.toContain("Inactive");
    expect(container.textContent).not.toContain("auto-deletes");
  });

  it("shows inactivity warning after 7 days", () => {
    const { container } = render(Page, {
      props: {
        data: makePageData({
          autoDeleteInfo: {
            inactiveDays: 12,
            daysUntilDeletion: 18,
            deletionDate: "2026-06-01T00:00:00.000Z",
            showWarning: true,
          },
        }) as never,
      },
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Inactive");
    expect(text).toContain("auto-deletes in 18 days");
  });

  it("shows tomorrow warning when 1 day left", () => {
    const { container } = render(Page, {
      props: {
        data: makePageData({
          autoDeleteInfo: {
            inactiveDays: 29,
            daysUntilDeletion: 1,
            deletionDate: "2026-06-01T00:00:00.000Z",
            showWarning: true,
          },
        }) as never,
      },
    });
    const text = container.textContent ?? "";
    expect(text).toContain("auto-deletes tomorrow");
  });

  it("shows scheduled for deletion when 0 days left", () => {
    const { container } = render(Page, {
      props: {
        data: makePageData({
          autoDeleteInfo: {
            inactiveDays: 30,
            daysUntilDeletion: 0,
            deletionDate: "2026-06-01T00:00:00.000Z",
            showWarning: true,
          },
        }) as never,
      },
    });
    const text = container.textContent ?? "";
    expect(text).toContain("scheduled for deletion");
  });
});
