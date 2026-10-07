import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGoto, mockPage, fetchMock } = vi.hoisted(() => ({
  mockGoto: vi.fn(async () => {}),
  mockPage: { url: new URL("http://localhost/create") },
  fetchMock: vi.fn(),
}));

vi.mock("$app/environment", () => ({ browser: false }));
vi.mock("$app/navigation", () => ({ goto: mockGoto }));
vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return { page: readable(mockPage) };
});
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

vi.stubGlobal("fetch", fetchMock);

const { default: Page } = await import("./+page.svelte");

type Team = {
  id: string;
  name: string;
  role: "editor" | "admin" | "owner";
  memberCount: number;
  counterCount: number;
  dashboardCount: number;
};

const alpha: Team = {
  id: "t-1",
  name: "Alpha",
  role: "owner",
  memberCount: 3,
  counterCount: 2,
  dashboardCount: 1,
};

function renderPage({
  teams = [] as Team[],
  preselectedType = null as "counter" | "dashboard" | "team" | null,
  loggedIn = true,
  search = "",
} = {}) {
  mockPage.url = new URL(`http://localhost/create${search}`);
  return render(Page, {
    props: {
      data: {
        session: loggedIn ? { user: { id: "user-1" } } : null,
        teams,
        preselectedType,
      } as never,
      params: {},
      form: null as never,
    },
  });
}

function respondOnce(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function stepDots(container: HTMLElement) {
  return container.querySelectorAll("span.h-2\\.5").length;
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, body: JSON.parse(init.body as string) };
}

async function waitForStep(heading: string | RegExp) {
  await waitFor(() => {
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toMatch(heading);
  });
}

async function createTeam(name = "New Team") {
  respondOnce(201, { id: "team-9", name });
  await fireEvent.input(screen.getByLabelText("Team name"), {
    target: { value: name },
  });
  await fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  await waitForStep("Invite members");
}

describe("Create page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("type step", () => {
    it("shows counter, dashboard and team cards", () => {
      renderPage();

      for (const name of [/^Counter/, /^Dashboard/, /^Team/]) {
        expect(
          (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
        ).toBe(false);
      }
    });

    it("locks dashboard and team for anonymous users", () => {
      renderPage({ loggedIn: false });

      expect(
        (screen.getByRole("button", { name: /^Counter/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
      for (const name of [/^Dashboard/, /^Team/]) {
        const card = screen.getByRole("button", { name }) as HTMLButtonElement;
        expect(card.disabled).toBe(true);
        expect(card.textContent).toContain("Sign in to unlock");
      }
    });
  });

  describe("owner step", () => {
    it("is skipped when the user has no teams", async () => {
      const { container } = renderPage();
      expect(stepDots(container)).toBe(3);

      await fireEvent.click(screen.getByRole("button", { name: /^Counter/ }));

      await waitForStep(/How should your counter be accessible/);
      expect(screen.queryByText(/Who should own/)).toBeNull();
      expect(stepDots(container)).toBe(4);
    });

    it("appears with teams and lists them with stats when Team is picked", async () => {
      const { container } = renderPage({ teams: [alpha] });

      await fireEvent.click(screen.getByRole("button", { name: /^Dashboard/ }));
      await waitForStep("Who should own your dashboard?");
      expect(stepDots(container)).toBe(4);
      expect(screen.queryByRole("group", { name: "Choose a team" })).toBeNull();

      await fireEvent.click(screen.getByRole("button", { name: /^Team/ }));

      const list = screen.getByRole("group", { name: "Choose a team" });
      const card = within(list).getByRole("button", { name: /Alpha/ });
      expect(card.textContent).toMatch(/3\s+members/);
      expect(card.textContent).toMatch(/2\s+counters/);
      expect(card.textContent).toMatch(/1\s+dashboard\b/);
      expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    });

    it("skips type and owner steps when coming from a team page, then submits teamId", async () => {
      respondOnce(201, { id: "c-new" });
      const { container } = renderPage({
        teams: [alpha],
        preselectedType: "counter",
        search: "?type=counter&teamId=t-1",
      });

      screen.getByRole("heading", {
        name: /How should your counter be accessible/,
      });
      expect(screen.queryByText(/Who should own/)).toBeNull();
      expect(stepDots(container)).toBe(3);

      expect(
        screen.getByRole("button", { name: /^Private/ }).className,
      ).toContain("ring-2");
      expect(
        screen.getByRole("button", { name: /^Public/ }).className,
      ).not.toContain("ring-2");

      await fireEvent.click(screen.getByRole("button", { name: /^Private/ }));
      await waitForStep("How should your counter change?");
      await fireEvent.click(
        screen.getByRole("button", { name: /^Increment only/ }),
      );
      await waitForStep("Name your counter");
      const titleInput = screen.getByPlaceholderText("Give it a name...");
      await fireEvent.input(titleInput, { target: { value: "Coffee" } });
      await fireEvent.submit(titleInput.closest("form") as HTMLFormElement);

      await waitFor(() => expect(mockGoto).toHaveBeenCalledWith("/c/c-new"));
      expect(lastRequest()).toEqual({
        url: "/api/counters",
        body: expect.objectContaining({
          title: "Coffee",
          visibility: "private",
          teamId: "t-1",
        }),
      });
    });

    it("skips the owner step for a team dashboard from the team page", () => {
      const { container } = renderPage({
        teams: [alpha],
        preselectedType: "dashboard",
        search: "?type=dashboard&teamId=t-1",
      });

      screen.getByRole("heading", {
        name: /How should your dashboard be accessible/,
      });
      expect(stepDots(container)).toBe(2);
    });

    it("keeps the owner step when ?teamId is not one of the user's teams", () => {
      renderPage({
        teams: [alpha],
        preselectedType: "counter",
        search: "?type=counter&teamId=unknown",
      });

      screen.getByRole("heading", { name: "Who should own your counter?" });
    });

    it("preselects private visibility after picking a team in the owner step", async () => {
      renderPage({ teams: [alpha] });

      await fireEvent.click(screen.getByRole("button", { name: /^Counter/ }));
      await waitForStep("Who should own your counter?");
      await fireEvent.click(screen.getByRole("button", { name: /^Team/ }));
      const list = screen.getByRole("group", { name: "Choose a team" });
      await fireEvent.click(within(list).getByRole("button", { name: /Alpha/ }));
      await waitForStep(/How should your counter be accessible/);

      expect(
        screen.getByRole("button", { name: /^Private/ }).className,
      ).toContain("ring-2");
    });

    it("keeps no default visibility for personal ownership", async () => {
      renderPage({ teams: [alpha] });

      await fireEvent.click(screen.getByRole("button", { name: /^Counter/ }));
      await waitForStep("Who should own your counter?");
      await fireEvent.click(screen.getByRole("button", { name: /^Me/ }));
      await waitForStep(/How should your counter be accessible/);

      for (const name of [/^Public/, /^Read-only/, /^Private/]) {
        expect(screen.getByRole("button", { name }).className).not.toContain(
          "ring-2",
        );
      }
    });
  });

  describe("team branch", () => {
    it("creates the team, offers invites without a way back, and finishes on the team page", async () => {
      const { container } = renderPage();

      await fireEvent.click(screen.getByRole("button", { name: /^Team/ }));
      await waitForStep("Name your team");
      expect(stepDots(container)).toBe(3);

      await createTeam();
      expect(lastRequest()).toEqual({
        url: "/api/teams",
        body: { name: "New Team" },
      });
      expect(
        screen.getByRole("button", { name: /Back/ }).className,
      ).toContain("invisible");

      const roleOptions = within(screen.getByLabelText("Role"))
        .getAllByRole("option")
        .map((o) => o.textContent);
      expect(roleOptions).toEqual([
        "Viewer",
        "Incrementer",
        "Editor",
        "Admin",
        "Owner",
      ]);

      respondOnce(201, { id: "inv-1" });
      await fireEvent.input(screen.getByLabelText("Username"), {
        target: { value: "bob" },
      });
      await fireEvent.change(screen.getByLabelText("Role"), {
        target: { value: "editor" },
      });
      await fireEvent.click(screen.getByRole("button", { name: "Invite" }));

      const invited = await screen.findByRole("list", {
        name: "Invited members",
      });
      expect(invited.textContent).toContain("bob");
      expect(invited.textContent).toContain("Editor");
      expect(lastRequest()).toEqual({
        url: "/t/team-9/members",
        body: { username: "bob", role: "editor" },
      });

      respondOnce(404, { error: "User not found" });
      await fireEvent.input(screen.getByLabelText("Username"), {
        target: { value: "ghost" },
      });
      await fireEvent.click(screen.getByRole("button", { name: "Invite" }));
      expect((await screen.findByRole("alert")).textContent).toContain(
        "User not found",
      );

      await fireEvent.click(screen.getByRole("button", { name: "Finish" }));
      expect(mockGoto).toHaveBeenCalledWith("/t/team-9/new-team");
    });

    it("shows two steps when preselected and finishes without invites", async () => {
      const { container } = renderPage({ preselectedType: "team" });

      screen.getByRole("heading", { name: "Name your team" });
      expect(stepDots(container)).toBe(2);

      await createTeam("Crew");
      await fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      expect(mockGoto).toHaveBeenCalledWith("/t/team-9/crew");
    });

    it("shows API field errors inline and stays on the name step", async () => {
      renderPage({ preselectedType: "team" });

      respondOnce(400, { errors: { name: ["Name is too long"] } });
      await fireEvent.input(screen.getByLabelText("Team name"), {
        target: { value: "x" },
      });
      await fireEvent.click(screen.getByRole("button", { name: "Create team" }));

      expect((await screen.findByRole("alert")).textContent).toContain(
        "Name is too long",
      );
      expect(screen.getByLabelText("Team name").getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(screen.queryByRole("heading", { name: "Invite members" })).toBeNull();
    });
  });
});
