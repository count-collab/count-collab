import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.stubGlobal("fetch", fetchMock);

const { default: CounterSettingsOverlay } =
  await import("./CounterSettingsOverlay.svelte");

function renderOverlay(onsave = vi.fn(), cooldownSeconds = 5) {
  render(CounterSettingsOverlay, {
    props: {
      open: true,
      canEdit: true,
      goals: [],
      onsave,
      counter: {
        id: "counter-1",
        title: "Coffee",
        description: null,
        visibilityMode: "public",
        counterMode: "increment_only",
        cooldownEnabled: false,
        cooldownSeconds,
        goalsEnabled: false,
        showAllReachedGoals: false,
        scoreboardEnabled: false,
      },
    },
  });
  return { onsave };
}

describe("CounterSettingsOverlay title", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("blocks blank titles and saves a valid title", async () => {
    const { onsave } = renderOverlay();

    const title = screen.getByPlaceholderText("Give it a name...");
    const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    for (const value of ["", " ", " \t "]) {
      await fireEvent.input(title, { target: { value } });
      expect(save.disabled).toBe(true);
      expect(screen.getByText("Title is required")).toBeTruthy();
      expect(title.getAttribute("aria-invalid")).toBe("true");
      await fireEvent.click(save);
      expect(fetchMock).not.toHaveBeenCalled();
    }

    await fireEvent.input(title, { target: { value: "a".repeat(201) } });
    expect(save.disabled).toBe(true);
    expect(screen.getByText("Title must be less than 200 characters")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce({ ok: true });
    await fireEvent.input(title, { target: { value: "a".repeat(200) } });
    expect(save.disabled).toBe(false);
    expect(screen.queryByText("Title is required")).toBeNull();
    await fireEvent.click(save);
    await waitFor(() => expect(onsave).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/counters/counter-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining(`"title":"${"a".repeat(200)}"`),
      }),
    );
  });

  it("shows the API title validation error and allows retrying", async () => {
    const { onsave } = renderOverlay();
    const title = screen.getByPlaceholderText("Give it a name...");
    const save = screen.getByRole("button", { name: "Save changes" });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        errors: { title: ["Title must be less than 200 characters"] },
      }),
    });
    await fireEvent.input(title, { target: { value: "Coffee" } });
    await fireEvent.click(save);
    expect(await screen.findByText("Title must be less than 200 characters")).toBeTruthy();
    expect(onsave).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce({ ok: true });
    await fireEvent.input(title, { target: { value: "Tea" } });
    await fireEvent.click(save);
    await waitFor(() => expect(onsave).toHaveBeenCalled());
    expect(screen.queryByText("Title must be less than 200 characters")).toBeNull();
  });

  it("validates the full update payload before sending", async () => {
    renderOverlay(vi.fn(), 0);
    await fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText(/Too small/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves the generic error when the API gives no details", async () => {
    renderOverlay();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Failed to save counter settings.")).toBeTruthy();
  });
});
