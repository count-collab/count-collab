import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGoto, mockPage, fetchMock } = vi.hoisted(() => {
  const pageState = {
    url: new URL("http://localhost/admin/statistics"),
  };

  return {
    mockGoto: vi.fn(async () => {}),
    mockPage: pageState,
    fetchMock: vi.fn(),
  };
});

vi.mock("$app/environment", () => ({
  browser: true,
}));

vi.mock("$app/navigation", () => ({
  goto: mockGoto,
}));

vi.mock("$app/state", () => ({
  page: mockPage,
}));

vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return {
    page: readable(mockPage),
  };
});

const jsonResponse = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => data,
  });

vi.stubGlobal("fetch", fetchMock);

const { default: Page } = await import("./+page.svelte");

describe("Admin statistics page URL persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url,
        "http://localhost",
      );

      if (url.pathname === "/api/admin/statistics/events") {
        return jsonResponse({
          timeframe: url.searchParams.get("timeframe") ?? "30d",
          page: Number(url.searchParams.get("page") ?? "1"),
          pageSize: 50,
          total: 120,
          totalPages: 3,
          queryDurationMs: 12,
          events: [
            {
              id: 1,
              eventType: "counter_action",
              userId: "user-1",
              entityId: "counter-1",
              entityType: "counter",
              metadata: { action: "increment" },
              createdAt: "2026-05-10T12:00:00.000Z",
              user: { name: "User", username: "user1", image: null },
            },
          ],
        });
      }

      if (url.pathname === "/api/admin/statistics/suggest") {
        if (url.searchParams.get("type") === "fields") {
          return jsonResponse({
            fields: [
              { name: "eventType", type: "string" },
              { name: "userId", type: "string" },
            ],
          });
        }
        return jsonResponse({ values: [] });
      }

      if (url.pathname === "/api/admin/statistics") {
        return jsonResponse({
          timeframe: url.searchParams.get("timeframe") ?? "30d",
          granularity: "daily",
          since: "2026-04-10T00:00:00.000Z",
          queryDurationMs: 9,
          timeSeries: {},
        });
      }

      if (url.pathname === "/api/admin/statistics/aggregate") {
        return jsonResponse({
          field: url.searchParams.get("field") ?? "eventType",
          timeframe: url.searchParams.get("timeframe") ?? "30d",
          queryDurationMs: 5,
          total: 0,
          values: [],
        });
      }

      return Promise.resolve({ ok: false, json: async () => ({}) });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("parses timeframe/page/filter from URL and uses them for EventLog requests", async () => {
    mockPage.url = new URL(
      "http://localhost/admin/statistics?timeframe=24h&page=2&filter.eventType=counter_action",
    );

    render(Page);

    await waitFor(() => {
      const eventCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = new URL(String(input), "http://localhost");
        return url.pathname === "/api/admin/statistics/events";
      });
      const eventCall = eventCalls.at(-1);

      expect(eventCall).toBeTruthy();
      const url = new URL(String(eventCall?.[0]), "http://localhost");
      expect(url.searchParams.get("timeframe")).toBe("24h");
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("filter.eventType")).toBe("counter_action");
    });
  });

  it("omits default timeframe/page and sorts filter params when persisting URL", async () => {
    mockPage.url = new URL(
      "http://localhost/admin/statistics?page=1&timeframe=30d&filter.userId=user-1&filter.eventType=counter_action",
    );

    render(Page);

    await waitFor(() => {
      expect(mockGoto).toHaveBeenCalledWith(
        "/admin/statistics?filter.eventType=counter_action&filter.userId=user-1",
        {
          replaceState: true,
          noScroll: true,
          keepFocus: true,
        },
      );
    });
  });
});
