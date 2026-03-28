import { render } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock SvelteKit modules
vi.mock("$app/environment", () => ({ browser: false }));
vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return {
    page: readable({ url: new URL("http://localhost/c/test-counter-id") }),
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
      ownerId: "owner-1",
      createdAt: "2025-06-15T10:30:00.000Z",
      updatedAt: "2026-03-20T14:00:00.000Z",
      shareToken: null,
    },
    history: [],
    canEdit: false,
    canDelete: false,
    canManage: false,
    isOwner: false,
    members: [],
    shareToken: null,
    hasValidToken: false,
    title: "Test Counter | Count Collab",
    description: "A test counter",
    ...overrides,
  };
}

describe("Counter detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(text).toContain(`Created ${expectedDate}`);
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
            isPublic: false,
          },
        }) as never,
      },
    });
    expect(container.textContent).toContain("Private");
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
});
