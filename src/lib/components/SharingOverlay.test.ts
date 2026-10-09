import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SharingOverlay from "./SharingOverlay.svelte";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function renderOverlay(type: "counter" | "dashboard" = "counter") {
  const onupdate = vi.fn();
  render(SharingOverlay, {
    props: {
      open: true,
      type,
      entityId: "e-1",
      entityTitle: "Coffee",
      shareUrl: "http://localhost/c/e-1",
      shareToken: null,
      visibilityMode: "public",
      members: [
        { id: 1, userId: "u-2", role: "viewer", username: "bob", image: null },
      ],
      invitations: [],
      canManage: true,
      isDirectMember: false,
      currentUserId: "u-1",
      onupdate,
    } as never,
  });
  return { onupdate };
}

async function openDialog() {
  await fireEvent.click(
    screen.getByRole("button", { name: "Edit role for bob" }),
  );
  return screen.getByRole("dialog", { name: "Change role for bob" });
}

async function chooseAndSave(dialog: HTMLElement, role: RegExp) {
  await fireEvent.click(within(dialog).getByRole("radio", { name: role }));
  await fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
}

describe("SharingOverlay member roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the role as text with an edit button instead of a select", () => {
    renderOverlay();
    expect(screen.queryByRole("combobox", { name: /Role for bob/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Edit role for bob" }),
    ).toBeTruthy();
  });

  it("offers incrementer for counters only", async () => {
    renderOverlay("counter");
    const dialog = await openDialog();
    expect(within(dialog).getAllByRole("radio")).toHaveLength(4);
    expect(
      within(dialog).getByRole("radio", { name: /^Incrementer/ }),
    ).toBeTruthy();
  });

  it("omits incrementer for dashboards", async () => {
    renderOverlay("dashboard");
    const dialog = await openDialog();
    expect(within(dialog).getAllByRole("radio")).toHaveLength(3);
    expect(
      within(dialog).queryByRole("radio", { name: /^Incrementer/ }),
    ).toBeNull();
  });

  it("patches the member role, calls onupdate and closes the dialog", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const { onupdate } = renderOverlay();
    const dialog = await openDialog();
    await chooseAndSave(dialog, /^Editor/);

    await waitFor(() => expect(onupdate).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/c/e-1/members/u-2");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ role: "editor" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Change role for bob" }),
      ).toBeNull(),
    );
    expect(screen.getByRole("dialog", { name: "Sharing" })).toBeTruthy();
  });

  it("shows an error and stays open when the update fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    });
    const { onupdate } = renderOverlay();
    const dialog = await openDialog();
    await chooseAndSave(dialog, /^Editor/);

    expect(await within(dialog).findByText("Forbidden")).toBeTruthy();
    expect(onupdate).not.toHaveBeenCalled();
  });

  it("changes an invitation role through the dialog", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const onupdate = vi.fn();
    render(SharingOverlay, {
      props: {
        open: true,
        type: "counter",
        entityId: "e-1",
        entityTitle: "Coffee",
        shareUrl: "http://localhost/c/e-1",
        shareToken: null,
        visibilityMode: "public",
        members: [],
        invitations: [
          {
            id: 5,
            userId: "u-9",
            role: "viewer",
            username: "carol",
            image: null,
            inviterUsername: "me",
            createdAt: new Date(),
          },
        ],
        canManage: true,
        isDirectMember: false,
        currentUserId: "u-1",
        onupdate,
      } as never,
    });
    await fireEvent.click(
      screen.getByRole("button", { name: "Edit role for invitation to carol" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Change role for carol",
    });
    await chooseAndSave(dialog, /^Editor/);

    await waitFor(() => expect(onupdate).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/c/e-1/invitations/u-9");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ role: "editor" });
  });

  it("closes only the role dialog on Escape", async () => {
    renderOverlay();
    await openDialog();
    await fireEvent.keyDown(window, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Change role for bob" }),
    ).toBeNull();
    expect(screen.getByRole("dialog", { name: "Sharing" })).toBeTruthy();
  });
});
