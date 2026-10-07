import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({ browser: false }));
vi.mock("$app/navigation", () => ({
  goto: vi.fn().mockResolvedValue(undefined),
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return {
    page: readable({
      url: new URL("http://localhost/t/team-1/the-crew"),
      data: { session: { user: { id: "user-1" } } },
    }),
  };
});
vi.mock("$lib/stores/counters", () => ({
  onCounterUpdated: vi.fn(() => () => {}),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { goto } = await import("$app/navigation");
const { default: Page } = await import("./+page.svelte");

type Role = "viewer" | "incrementer" | "editor" | "admin" | "owner";

function member(userId: string, username: string, role: Role) {
  return {
    id: userId,
    teamId: "team-1",
    userId,
    role,
    username,
    name: null,
    image: null,
    joinedAt: new Date("2026-01-15T10:00:00.000Z"),
  };
}

function makePageData(role: Role, overrides: Record<string, unknown> = {}) {
  const canManage = role === "admin" || role === "owner";
  return {
    session: { user: { id: "user-1" } },
    team: {
      id: "team-1",
      name: "The Crew",
      description: "Our shared counters",
      createdBy: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    role,
    members: [member("user-1", "me", role), member("user-2", "bob", "viewer")],
    invitations: [],
    resources: {
      counters: [
        {
          id: "c-1",
          title: "Coffee",
          description: null,
          count: 3,
          ownerId: null,
          visibilityMode: "private",
          isPublic: false,
        },
      ],
      dashboards: [
        {
          id: "d-1",
          title: "Office",
          description: null,
          visibilityMode: "private",
        },
        {
          id: "d-2",
          title: "Home",
          description: null,
          visibilityMode: "private",
        },
      ],
    },
    canManage,
    canDelete: role === "owner",
    canEditResources: role !== "viewer" && role !== "incrementer",
    joinToken: canManage ? "join-token-123" : null,
    joinRole: canManage ? "viewer" : null,
    title: "The Crew | Team | Count Collab",
    ...overrides,
  };
}

function renderPage(role: Role, overrides: Record<string, unknown> = {}) {
  return render(Page, {
    props: { data: makePageData(role, overrides) as never },
  });
}

function tabNames(): string[] {
  return screen
    .getAllByRole("tab")
    .map((tab) => tab.textContent?.replace(/\d+/g, "").trim() ?? "");
}

describe("Team page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the team header with the user's role", () => {
    const { container } = renderPage("editor");
    expect(
      screen.getByRole("heading", { level: 1, name: "The Crew" }),
    ).toBeTruthy();
    expect(container.textContent).toContain("Our shared counters");
    expect(container.textContent).toContain("Editor");
  });

  it.each(["viewer", "incrementer", "editor", "admin", "owner"] as const)(
    "shows only Counters, Dashboards and Members tabs for %s",
    (role) => {
      renderPage(role);
      expect(tabNames()).toEqual(["Counters", "Dashboards", "Members"]);
    },
  );

  it.each(["viewer", "incrementer", "editor"] as const)(
    "hides the settings button for %s",
    (role) => {
      renderPage(role);
      expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    },
  );

  it.each(["admin", "owner"] as const)(
    "opens the settings overlay for %s",
    async (role) => {
      renderPage(role);
      expect(
        screen.queryByRole("dialog", { name: "Team Settings" }),
      ).toBeNull();
      await fireEvent.click(screen.getByRole("button", { name: "Settings" }));
      const overlay = screen.getByRole("dialog", { name: "Team Settings" });
      expect(
        (within(overlay).getByLabelText("Team name") as HTMLInputElement).value,
      ).toBe("The Crew");
    },
  );

  it("shows the New counter link only when resources are editable", () => {
    renderPage("viewer");
    expect(screen.queryByRole("link", { name: /New counter/ })).toBeNull();
    cleanup();

    renderPage("editor");
    const link = screen.getByRole("link", { name: /New counter/ });
    expect(link.getAttribute("href")).toBe(
      "/create?type=counter&teamId=team-1",
    );
  });

  it("shows the New dashboard link only when resources are editable", async () => {
    renderPage("viewer");
    await fireEvent.click(screen.getByRole("tab", { name: /Dashboards/ }));
    expect(screen.queryByRole("link", { name: /New dashboard/ })).toBeNull();
    cleanup();

    renderPage("editor");
    await fireEvent.click(screen.getByRole("tab", { name: /Dashboards/ }));
    const link = screen.getByRole("link", { name: /New dashboard/ });
    expect(link.getAttribute("href")).toBe(
      "/create?type=dashboard&teamId=team-1",
    );
  });

  it("switches to the dashboards tab", async () => {
    renderPage("viewer");
    await fireEvent.click(screen.getByRole("tab", { name: /Dashboards/ }));
    expect(
      screen
        .getByRole("tab", { name: /Dashboards/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByText("Office")).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("keeps a fixed tab bar size when switching tabs", async () => {
    renderPage("viewer");
    expect(screen.getByRole("tablist").className).not.toContain("overflow");

    await fireEvent.click(screen.getByRole("tab", { name: /Members/ }));
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).toContain("border-b-2");
      expect(tab.className).not.toContain("transition-all");
    }
  });

  it("does not show member management to non-managers", async () => {
    renderPage("editor");
    await fireEvent.click(screen.getByRole("tab", { name: /Members/ }));
    expect(screen.getByText("bob")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.queryByLabelText("Username")).toBeNull();
  });

  it("shows only the member list for non-managers", async () => {
    renderPage("editor");
    await fireEvent.click(screen.getByRole("tab", { name: /Members/ }));
    expect(screen.getByRole("heading", { name: "Members" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Invite member" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Join link" })).toBeNull();
    expect(screen.queryByTestId("team-join-url")).toBeNull();
  });

  it("shows invite, invitations and join link sections for managers", async () => {
    renderPage("admin", {
      invitations: [
        {
          id: "inv-1",
          userId: "user-9",
          role: "viewer",
          username: "carol",
          name: null,
          image: null,
          inviterUsername: "me",
        },
      ],
    });
    await fireEvent.click(screen.getByRole("tab", { name: /Members/ }));
    expect(screen.getByRole("heading", { name: "Invite member" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Pending invitations" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Join link" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Members" })).toBeTruthy();
  });

  it("limits role options for admins to non-owner roles", async () => {
    renderPage("admin");
    await fireEvent.click(screen.getByRole("tab", { name: /Members/ }));

    const memberSelect = screen.getByRole("combobox", { name: "Role for bob" });
    const memberOptions = within(memberSelect)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(memberOptions).not.toContain("Owner");

    const inviteOptions = within(screen.getByLabelText("Role"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(inviteOptions).toEqual(["Viewer", "Incrementer", "Editor", "Admin"]);
  });

  it("does not let admins modify owners", async () => {
    renderPage("admin", {
      members: [
        member("user-1", "me", "admin"),
        member("user-3", "olivia", "owner"),
      ],
    });
    await fireEvent.click(screen.getByRole("tab", { name: /Members/ }));
    expect(
      screen.queryByRole("combobox", { name: "Role for olivia" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove olivia" })).toBeNull();
  });

  it("lets owners assign the owner role", async () => {
    renderPage("owner");
    await fireEvent.click(screen.getByRole("tab", { name: /Members/ }));
    const options = within(
      screen.getByRole("combobox", { name: "Role for bob" }),
    )
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toContain("Owner");
  });

  it("hides the danger zone for admins", async () => {
    renderPage("admin");
    await fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const overlay = screen.getByRole("dialog", { name: "Team Settings" });
    expect(
      within(overlay).queryByRole("button", { name: "Delete team" }),
    ).toBeNull();
  });

  it("shows the full join URL in the Members tab when the join link is enabled", async () => {
    renderPage("owner");
    await fireEvent.click(screen.getByRole("tab", { name: /Members/ }));
    expect(screen.getByTestId("team-join-url").textContent?.trim()).toBe(
      "http://localhost/t/team-1/join?token=join-token-123",
    );
  });

  it("requires the exact team name to confirm deletion", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, counterIds: [], dashboardIds: [] }),
    });
    renderPage("owner");
    await fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const overlay = screen.getByRole("dialog", { name: "Team Settings" });
    await fireEvent.click(
      within(overlay).getByRole("button", { name: "Delete team" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Delete team?" });
    expect(dialog.textContent?.replace(/\s+/g, " ")).toContain(
      "All 1 counter and 2 dashboards in this team will be permanently deleted.",
    );

    const input = within(dialog).getByLabelText(/to confirm/);
    const confirm = within(dialog).getByRole("button", { name: "Delete team" });
    expect(confirm.hasAttribute("disabled")).toBe(true);

    await fireEvent.input(input, { target: { value: "the crew" } });
    expect(confirm.hasAttribute("disabled")).toBe(true);

    await fireEvent.input(input, { target: { value: "The Crew " } });
    expect(confirm.hasAttribute("disabled")).toBe(true);

    await fireEvent.input(input, { target: { value: "The Crew" } });
    expect(confirm.hasAttribute("disabled")).toBe(false);

    await fireEvent.click(confirm);
    await vi.waitFor(() => expect(goto).toHaveBeenCalledWith("/my/teams"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/teams/team-1",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ confirmName: "The Crew" }),
      }),
    );
  });

  it("shows the last-owner error when leaving fails with 409", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({ error: "A team must have at least one owner" }),
    });
    renderPage("owner");
    await fireEvent.click(screen.getByRole("button", { name: /Leave team/ }));

    const dialog = screen.getByRole("dialog", { name: "Leave team?" });
    await fireEvent.click(
      within(dialog).getByRole("button", { name: "Leave team" }),
    );

    expect(
      await within(dialog).findByText("A team must have at least one owner"),
    ).toBeTruthy();
    expect(goto).not.toHaveBeenCalled();
  });

  it("hides Leave team for non-members acting as owner", () => {
    renderPage("owner", { members: [member("user-2", "bob", "owner")] });
    expect(screen.queryByRole("button", { name: /Leave team/ })).toBeNull();
  });
});
