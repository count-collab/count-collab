import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.stubGlobal("fetch", fetchMock);

const { default: ChangeOwnerOverlay } =
  await import("./ChangeOwnerOverlay.svelte");

const users = [
  { id: "user-2", username: "alice", email: "alice@example.com", image: null },
  { id: "user-3", username: "bob", email: null, image: null },
];

function mockApi({ saveOk = true }: { saveOk?: boolean } = {}) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      return saveOk
        ? { ok: true, json: async () => ({ success: true }) }
        : { ok: false, json: async () => ({ error: "Owner not allowed" }) };
    }
    return { ok: true, json: async () => ({ users }) };
  });
}

function renderOverlay(
  props: { currentOwnerName?: string | null; onsave?: () => void } = {},
) {
  return render(ChangeOwnerOverlay, {
    props: {
      open: true,
      counterId: "counter-1",
      counterTitle: "Coffee Cups",
      currentOwnerName: "@carol",
      ...props,
    },
  });
}

function saveButton() {
  return screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
}

async function search(value: string) {
  await fireEvent.input(screen.getByRole("textbox", { name: "Search users" }), {
    target: { value },
  });
}

function patchRequest() {
  const call = fetchMock.mock.calls.find(
    ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
  );
  if (!call) return null;
  const [url, init] = call as [string, RequestInit];
  return { url, body: JSON.parse(init.body as string) };
}

describe("ChangeOwnerOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("renders the dialog with the counter and current owner", () => {
    renderOverlay();

    expect(screen.getByRole("dialog", { name: "Change Owner" })).toBeTruthy();
    expect(screen.getByText("Coffee Cups")).toBeTruthy();
    expect(screen.getByText("@carol")).toBeTruthy();
  });

  it("shows user search results", async () => {
    renderOverlay();
    await search("al");

    expect(await screen.findByText("@alice")).toBeTruthy();
    expect(screen.getByText("@bob")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/search?q=al");
  });

  it("disables Save until a selection is made", async () => {
    renderOverlay();
    expect(saveButton().disabled).toBe(true);

    await search("al");
    await fireEvent.click(
      await screen.findByRole("button", { name: /@alice/ }),
    );

    expect(saveButton().disabled).toBe(false);
  });

  it("sends the selected user id and calls onsave", async () => {
    const onsave = vi.fn();
    renderOverlay({ onsave });
    await search("al");
    await fireEvent.click(
      await screen.findByRole("button", { name: /@alice/ }),
    );
    await fireEvent.click(saveButton());

    await vi.waitFor(() => expect(onsave).toHaveBeenCalledOnce());
    expect(patchRequest()).toEqual({
      url: "/api/admin/counters/counter-1/owner",
      body: { ownerId: "user-2" },
    });
    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Change Owner" })).toBeNull(),
    );
  });

  it("sends a null owner when Remove owner is selected", async () => {
    const onsave = vi.fn();
    renderOverlay({ onsave });

    await fireEvent.click(screen.getByRole("button", { name: "Remove owner" }));
    await fireEvent.click(saveButton());

    await vi.waitFor(() => expect(onsave).toHaveBeenCalledOnce());
    expect(patchRequest()?.body).toEqual({ ownerId: null });
  });

  it("hides Remove owner when the counter has no owner", () => {
    renderOverlay({ currentOwnerName: null });

    expect(screen.queryByRole("button", { name: "Remove owner" })).toBeNull();
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("shows the server error and stays open when saving fails", async () => {
    mockApi({ saveOk: false });
    const onsave = vi.fn();
    renderOverlay({ onsave });

    await fireEvent.click(screen.getByRole("button", { name: "Remove owner" }));
    await fireEvent.click(saveButton());

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Owner not allowed",
    );
    expect(onsave).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Change Owner" })).toBeTruthy();
  });

  it("closes via Cancel", async () => {
    renderOverlay();

    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await vi.waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Change Owner" })).toBeNull(),
    );
  });
});
