import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGoto, mockInvalidateAll, fetchMock } = vi.hoisted(() => ({
  mockGoto: vi.fn(async () => {}),
  mockInvalidateAll: vi.fn(async () => {}),
  fetchMock: vi.fn(),
}));

vi.mock("$app/navigation", () => ({
  goto: mockGoto,
  invalidateAll: mockInvalidateAll,
}));

vi.stubGlobal("fetch", fetchMock);

const { default: TeamSettingsOverlay } = await import(
  "./TeamSettingsOverlay.svelte"
);

const team = {
  id: "team-1",
  name: "The Crew",
  description: "Our shared counters",
};

function renderOverlay(props: { canDelete?: boolean } = {}) {
  return render(TeamSettingsOverlay, {
    props: {
      open: true,
      team,
      canDelete: true,
      counterCount: 1,
      dashboardCount: 2,
      ...props,
    },
  });
}

function okResponse() {
  return { ok: true, json: async () => ({ success: true }) };
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, method: init.method, body: JSON.parse(init.body as string) };
}

describe("TeamSettingsOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("prefills name and description", () => {
    renderOverlay();
    expect(
      (screen.getByLabelText("Team name") as HTMLInputElement).value,
    ).toBe("The Crew");
    expect(
      (screen.getByLabelText("Team description") as HTMLInputElement).value,
    ).toBe("Our shared counters");
  });

  it("sends trimmed name and description and navigates to the new slug", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    renderOverlay();
    await fireEvent.input(screen.getByLabelText("Team name"), {
      target: { value: "  New Crew " },
    });
    await fireEvent.input(screen.getByLabelText("Team description"), {
      target: { value: "  Updated  " },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => expect(mockGoto).toHaveBeenCalled());
    expect(lastRequest()).toEqual({
      url: "/api/teams/team-1",
      method: "PATCH",
      body: { name: "New Crew", description: "Updated" },
    });
    expect(mockGoto).toHaveBeenCalledWith(
      "/t/team-1/new-crew",
      expect.objectContaining({ replaceState: true, invalidateAll: true }),
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Team Settings" })).toBeNull(),
    );
  });

  it("sends a null description when cleared and invalidates without renaming", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    renderOverlay();
    await fireEvent.input(screen.getByLabelText("Team description"), {
      target: { value: "   " },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => expect(mockInvalidateAll).toHaveBeenCalled());
    expect(lastRequest().body).toEqual({ name: "The Crew", description: null });
    expect(mockGoto).not.toHaveBeenCalled();
  });

  it("shows the server error and stays open when saving fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Name already taken" }),
    });
    renderOverlay();
    await fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Name already taken")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Team Settings" })).toBeTruthy();
  });

  it("disables saving with an empty name", async () => {
    renderOverlay();
    await fireEvent.input(screen.getByLabelText("Team name"), {
      target: { value: "   " },
    });
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows the danger zone only with canDelete", () => {
    renderOverlay({ canDelete: false });
    expect(screen.queryByText("Danger zone")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete team" })).toBeNull();
    cleanup();

    renderOverlay({ canDelete: true });
    expect(screen.getByText("Danger zone")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete team" })).toBeTruthy();
  });

  it("requires the exact team name before deleting", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    renderOverlay();
    await fireEvent.click(screen.getByRole("button", { name: "Delete team" }));

    const dialog = screen.getByRole("dialog", { name: "Delete team?" });
    expect(dialog.textContent?.replace(/\s+/g, " ")).toContain(
      "All 1 counter and 2 dashboards in this team will be permanently deleted.",
    );

    const input = within(dialog).getByLabelText(/to confirm/);
    const confirm = within(dialog).getByRole("button", { name: "Delete team" });
    expect(confirm.hasAttribute("disabled")).toBe(true);

    await fireEvent.input(input, { target: { value: "the crew" } });
    expect(confirm.hasAttribute("disabled")).toBe(true);

    await fireEvent.input(input, { target: { value: "The Crew" } });
    expect(confirm.hasAttribute("disabled")).toBe(false);

    await fireEvent.click(confirm);
    await vi.waitFor(() => expect(mockGoto).toHaveBeenCalledWith("/my/teams"));
    expect(lastRequest()).toEqual({
      url: "/api/teams/team-1",
      method: "DELETE",
      body: { confirmName: "The Crew" },
    });
  });

  it("closes only the delete modal on Escape", async () => {
    renderOverlay();
    await fireEvent.click(screen.getByRole("button", { name: "Delete team" }));
    expect(screen.getByRole("dialog", { name: "Delete team?" })).toBeTruthy();

    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Delete team?" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Team Settings" })).toBeTruthy();
  });
});
