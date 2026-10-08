import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.stubGlobal("fetch", fetchMock);

const { default: AddCounterOverlay } =
  await import("./AddCounterOverlay.svelte");

type Item = {
  id: string;
  title: string;
  description: string | null;
  count: number;
  visibilityMode: "public" | "public_readonly" | "private";
  ownerId: string | null;
  teamId: string | null;
  teamName: string | null;
  isMine: boolean;
  onDashboard: boolean;
};

function counter(overrides: Partial<Item> & { id: string; title: string }) {
  return {
    description: null,
    count: 1,
    visibilityMode: "public" as const,
    ownerId: "user-1",
    teamId: null,
    teamName: null,
    isMine: true,
    onDashboard: false,
    ...overrides,
  };
}

const personal = counter({ id: "c-personal", title: "Personal One" });
const teamOwned = counter({
  id: "c-team",
  title: "Team One",
  ownerId: "user-2",
  teamId: "team-1",
  teamName: "Alpha",
});
const popular = counter({
  id: "c-popular",
  title: "Popular One",
  ownerId: "user-3",
  isMine: false,
  count: 999,
});

function mockSearch({
  mine = [personal, teamOwned],
  others = [popular],
}: { mine?: Item[]; others?: Item[] } = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    const scope = new URL(url, "http://localhost").searchParams.get("scope");
    return {
      ok: true,
      json: async () => ({
        items: scope === "mine" ? mine : others,
        userId: "user-1",
      }),
    };
  });
}

function renderOverlay(
  props: { existingCounterIds?: string[]; onAdd?: (id: string) => void } = {},
) {
  return render(AddCounterOverlay, {
    props: {
      open: true,
      dashboardId: "dash-1",
      existingCounterIds: [],
      onAdd: vi.fn(),
      ...props,
    },
  });
}

function requestedParams() {
  return fetchMock.mock.calls.map(
    ([url]) => new URL(url as string, "http://localhost").searchParams,
  );
}

async function yourCounters() {
  return screen.findByRole("region", { name: "Your Counters" });
}

describe("AddCounterOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch();
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("renders a dialog named Add Counter when open", () => {
    renderOverlay();
    expect(screen.getByRole("dialog", { name: "Add Counter" })).toBeTruthy();
  });

  it("fetches mine and others scopes on open", async () => {
    renderOverlay();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const params = requestedParams();
    expect(
      params.map((p) => [p.get("scope"), p.get("limit"), p.get("q")]),
    ).toEqual(
      expect.arrayContaining([
        ["mine", "50", null],
        ["others", "20", null],
      ]),
    );
    expect(fetchMock.mock.calls[0][0]).toMatch(
      /^\/api\/dashboards\/dash-1\/search-counters\?/,
    );
  });

  it("renders Your Counters and Popular sections", async () => {
    renderOverlay();

    const mine = await yourCounters();
    expect(within(mine).getByText("Personal One")).toBeTruthy();
    expect(within(mine).getByText("Team One")).toBeTruthy();

    const popularSection = screen.getByRole("region", { name: "Popular" });
    expect(within(popularSection).getByText("Popular One")).toBeTruthy();
  });

  it("filters Your Counters by owner without affecting Popular", async () => {
    renderOverlay();
    const mine = await yourCounters();

    await fireEvent.click(screen.getByRole("button", { name: "Personal" }));
    expect(within(mine).getByText("Personal One")).toBeTruthy();
    expect(within(mine).queryByText("Team One")).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(within(mine).queryByText("Personal One")).toBeNull();
    expect(within(mine).getByText("Team One")).toBeTruthy();

    expect(screen.getByText("Popular One")).toBeTruthy();
  });

  it("shows an empty state when the filter matches nothing", async () => {
    mockSearch({ mine: [teamOwned] });
    renderOverlay();
    await yourCounters();

    await fireEvent.click(screen.getByRole("button", { name: "Personal" }));

    expect(screen.getByText("No counters in this filter.")).toBeTruthy();
  });

  it("hides the owner filter when there are no team counters", async () => {
    mockSearch({ mine: [personal] });
    renderOverlay();
    await yourCounters();

    expect(screen.queryByRole("group", { name: "Filter by owner" })).toBeNull();
  });

  it("lists counters from existingCounterIds as Added without an Add button", async () => {
    renderOverlay({ existingCounterIds: ["c-personal", "c-popular"] });
    const mine = await yourCounters();

    expect(within(mine).getByText("Personal One")).toBeTruthy();
    expect(within(mine).getByText("Team One")).toBeTruthy();
    expect(screen.getByText("Popular One")).toBeTruthy();
    expect(screen.getAllByText("Added")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Add Personal One" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add Popular One" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Add Team One" })).toBeTruthy();
    expect(screen.queryByText(/\d+ added/)).toBeNull();
  });

  it("lists counters flagged onDashboard by the API as Added", async () => {
    mockSearch({
      mine: [{ ...personal, onDashboard: true }, teamOwned],
      others: [{ ...popular, onDashboard: true }],
    });
    renderOverlay();
    const mine = await yourCounters();

    expect(within(mine).getByText("Personal One")).toBeTruthy();
    expect(screen.getByText("Popular One")).toBeTruthy();
    expect(screen.getAllByText("Added")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Add Personal One" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add Popular One" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Add Team One" })).toBeTruthy();
    expect(screen.queryByText(/\d+ added/)).toBeNull();
  });

  it("calls onAdd, marks the row as added and counts additions", async () => {
    const onAdd = vi.fn();
    renderOverlay({ onAdd });
    await yourCounters();

    await fireEvent.click(
      screen.getByRole("button", { name: "Add Personal One" }),
    );

    expect(onAdd).toHaveBeenCalledWith("c-personal");
    expect(screen.getByText("Added")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Add Personal One" }),
    ).toBeNull();
    expect(screen.getByText("1 added")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Add Counter" })).toBeTruthy();
  });

  it("keeps added counters listed as Added after the parent updates", async () => {
    const onAdd = vi.fn();
    const { rerender } = renderOverlay({ onAdd });
    const mine = await yourCounters();

    vi.useFakeTimers();
    try {
      await fireEvent.click(
        screen.getByRole("button", { name: "Add Personal One" }),
      );
      await rerender({ existingCounterIds: ["c-personal"] });
      await vi.advanceTimersByTimeAsync(2000);

      expect(within(mine).getByText("Personal One")).toBeTruthy();
      expect(within(mine).getByText("Added")).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Add Personal One" }),
      ).toBeNull();
      expect(screen.getByText("1 added")).toBeTruthy();
      expect(onAdd).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("searches both scopes with the query and shows Other Counters", async () => {
    renderOverlay();
    await yourCounters();
    fetchMock.mockClear();

    await fireEvent.input(
      screen.getByRole("textbox", { name: "Search counters" }),
      { target: { value: "one" } },
    );

    expect(
      await screen.findByRole("region", { name: "Other Counters" }),
    ).toBeTruthy();
    const params = requestedParams();
    expect(
      params.map((p) => [p.get("scope"), p.get("limit"), p.get("q")]),
    ).toEqual(
      expect.arrayContaining([
        ["mine", "50", "one"],
        ["others", "20", "one"],
      ]),
    );
  });

  it("shows the API error message when loading fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Forbidden" }),
    });
    renderOverlay();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Forbidden",
    );
  });

  it("closes when Done is clicked", async () => {
    renderOverlay();

    await fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add Counter" })).toBeNull(),
    );
  });
});
