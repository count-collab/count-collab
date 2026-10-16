import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("$app/navigation", () => ({
  goto: vi.fn(async () => {}),
  invalidateAll: vi.fn(async () => {}),
}));

vi.stubGlobal("fetch", fetchMock);

const { default: DashboardSettingsOverlay } =
  await import("./DashboardSettingsOverlay.svelte");

const dashboard = {
  id: "dash-1",
  title: "Team Stats",
  description: "Weekly numbers",
  visibilityMode: "public" as const,
  gridColumns: 5,
};

function renderOverlay(onsave = vi.fn()) {
  render(DashboardSettingsOverlay, {
    props: { open: true, dashboard, onsave },
  });
  return { onsave };
}

describe("DashboardSettingsOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders column options 2–5 with the current value checked", () => {
    renderOverlay();
    const group = screen.getByRole("radiogroup", { name: "Columns" });
    const options = screen.getAllByRole("radio");
    expect(group).toBeTruthy();
    expect(options.map((o) => o.getAttribute("aria-label"))).toEqual([
      "2 columns",
      "3 columns",
      "4 columns",
      "5 columns",
    ]);
    expect(
      screen
        .getByRole("radio", { name: "5 columns" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "3 columns" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("sends the selected column count in the PATCH body", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const { onsave } = renderOverlay();

    const three = screen.getByRole("radio", { name: "3 columns" });
    await fireEvent.click(three);
    expect(three.getAttribute("aria-checked")).toBe("true");

    await fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => expect(onsave).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/dashboards/dash-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      title: "Team Stats",
      description: "Weekly numbers",
      visibility: "public",
      gridColumns: 3,
    });
  });
});
