import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvalidateAll, mockPage, fetchMock } = vi.hoisted(() => ({
  mockInvalidateAll: vi.fn(async () => {}),
  mockPage: { url: new URL("http://localhost/admin/teams") },
  fetchMock: vi.fn(),
}));

vi.mock("$app/navigation", () => ({
  invalidateAll: mockInvalidateAll,
}));

vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return { page: readable(mockPage) };
});

vi.stubGlobal("fetch", fetchMock);

const { default: Page } = await import("./+page.svelte");

const team = {
  id: "team-1",
  name: "Alpha Squad",
  description: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  memberCount: 4,
  counterCount: 3,
  dashboardCount: 1,
};

const data = {
  teams: [team],
  total: 1,
  query: undefined,
  page: 1,
  totalPages: 1,
};

function renderPage() {
  return render(Page, { props: { data: data as any } });
}

describe("Admin teams page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders team rows linking to the team page", () => {
    renderPage();
    const link = screen.getAllByRole("link", { name: "Alpha Squad" })[0];
    expect(link.getAttribute("href")).toBe("/t/team-1");
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("requires the exact team name before deleting", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, counterIds: [], dashboardIds: [] }),
    });
    renderPage();

    await fireEvent.click(
      screen.getByRole("button", { name: "Delete team Alpha Squad" }),
    );

    expect(screen.getByText(/3 counters/)).toBeTruthy();
    expect(screen.getByText(/1 dashboard\b/)).toBeTruthy();

    const submit = screen.getByRole("button", {
      name: "Delete team",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const input = screen.getByLabelText(/to confirm/);
    await fireEvent.input(input, { target: { value: "alpha squad" } });
    expect(submit.disabled).toBe(true);

    await fireEvent.input(input, { target: { value: "Alpha Squad" } });
    expect(submit.disabled).toBe(false);

    await fireEvent.click(submit);

    await waitFor(() => expect(mockInvalidateAll).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/teams/team-1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName: "Alpha Squad" }),
    });
  });

  it("shows the server error and keeps the modal open on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Confirmation name does not match" }),
    });
    renderPage();

    await fireEvent.click(
      screen.getByRole("button", { name: "Delete team Alpha Squad" }),
    );
    await fireEvent.input(screen.getByLabelText(/to confirm/), {
      target: { value: "Alpha Squad" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Delete team" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Confirmation name does not match",
    );
    expect(mockInvalidateAll).not.toHaveBeenCalled();
  });
});
