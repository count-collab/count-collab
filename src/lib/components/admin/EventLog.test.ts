import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventLog from "./EventLog.svelte";

const fetchMock = vi.fn();

vi.mock("$app/environment", () => ({
  browser: true,
}));

vi.stubGlobal("fetch", fetchMock);

const baseEvent = {
  id: 1,
  eventType: "counter_action",
  userId: "user-1",
  entityId: "counter-1",
  entityType: "counter",
  metadata: { action: "increment" },
  createdAt: "2026-05-10T12:00:00.000Z",
  user: { name: "User", username: "user1", image: null },
};

describe("EventLog controlled pagination", () => {
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
        return Promise.resolve({
          ok: true,
          json: async () => ({
            timeframe: "30d",
            page: Number(url.searchParams.get("page") ?? "1"),
            pageSize: 50,
            total: 250,
            totalPages: 5,
            queryDurationMs: 11,
            events: [baseEvent],
          }),
        });
      }

      if (url.pathname === "/api/admin/statistics/suggest") {
        if (url.searchParams.get("type") === "fields") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ values: [] }),
        });
      }

      return Promise.resolve({ ok: false, json: async () => ({}) });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders pagination using the controlled page prop", async () => {
    render(EventLog, {
      props: {
        timeframe: "30d",
        page: 2,
        filters: {},
        onFilterChange: vi.fn(),
        onPageChange: vi.fn(),
        onAggregateField: vi.fn(),
      } as never,
    });

    const nav = await screen.findByRole("navigation", {
      name: "Event log pagination",
    });

    expect(within(nav).queryByRole("button", { name: "2" })).toBeNull();
    expect(within(nav).getByText("2")).toBeTruthy();
  });

  it("calls onPageChange with next page when Next is clicked", async () => {
    const onPageChange = vi.fn();

    render(EventLog, {
      props: {
        timeframe: "30d",
        page: 2,
        filters: {},
        onFilterChange: vi.fn(),
        onPageChange,
        onAggregateField: vi.fn(),
      } as never,
    });

    const nav = await screen.findByRole("navigation", {
      name: "Event log pagination",
    });

    await fireEvent.click(within(nav).getByRole("button", { name: /Next/i }));

    await waitFor(() => {
      expect(onPageChange).toHaveBeenCalledWith(3);
    });
  });

  it("calls onPageChange with selected page number", async () => {
    const onPageChange = vi.fn();

    render(EventLog, {
      props: {
        timeframe: "30d",
        page: 2,
        filters: {},
        onFilterChange: vi.fn(),
        onPageChange,
        onAggregateField: vi.fn(),
      } as never,
    });

    const nav = await screen.findByRole("navigation", {
      name: "Event log pagination",
    });

    await fireEvent.click(within(nav).getByRole("button", { name: "4" }));

    await waitFor(() => {
      expect(onPageChange).toHaveBeenCalledWith(4);
    });
  });

  it("calls onFilterChange with remaining filters when a filter chip is removed", async () => {
    const onFilterChange = vi.fn();

    render(EventLog, {
      props: {
        timeframe: "30d",
        page: 2,
        filters: {
          eventType: "counter_action",
          userId: "user-1",
        },
        onFilterChange,
        onPageChange: vi.fn(),
        onAggregateField: vi.fn(),
      } as never,
    });

    const filterValue = await screen.findByText("counter_action");
    const removeButton = filterValue.closest("button");
    expect(removeButton).toBeTruthy();

    await fireEvent.click(removeButton as HTMLButtonElement);

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenCalledWith({ userId: "user-1" });
    });
  });
});
