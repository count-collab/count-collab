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
  mockPage: { url: new URL("http://localhost/my/teams") },
  fetchMock: vi.fn(),
}));

vi.mock("$app/navigation", () => ({ goto: mockGoto }));

vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return { page: readable(mockPage) };
});

vi.stubGlobal("fetch", fetchMock);

const { default: Page } = await import("./+page.svelte");

function team(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    name: "Alpha Squad",
    description: "Shared stuff",
    role: "owner",
    memberCount: 1,
    counterCount: 2,
    dashboardCount: 0,
    ...overrides,
  };
}

function renderPage(teams: ReturnType<typeof team>[] = []) {
  return render(Page, { props: { data: { teams } as any } });
}

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

async function openModal() {
  await fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  return screen.getByRole("dialog");
}

async function submit(dialog: HTMLElement, name: string, description = "") {
  await fireEvent.input(within(dialog).getByLabelText("Name"), {
    target: { value: name },
  });
  await fireEvent.input(within(dialog).getByLabelText(/Description/), {
    target: { value: description },
  });
  await fireEvent.click(
    within(dialog).getByRole("button", { name: "Create team" }),
  );
}

describe("My teams page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("team list", () => {
    it("shows an empty state that opens the create modal", async () => {
      renderPage();

      await fireEvent.click(
        screen.getByRole("button", { name: "Create your first team" }),
      );

      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("renders a card per team with link, counts and role", () => {
      renderPage([
        team(),
        team({
          id: "team-2",
          name: "Beta",
          description: null,
          role: "viewer",
          memberCount: 4,
          counterCount: 1,
          dashboardCount: 3,
        }),
      ]);

      const alpha = screen.getByRole("link", { name: /Alpha Squad/ });
      expect(alpha.getAttribute("href")).toBe("/t/team-1/alpha-squad");
      expect(alpha.textContent).toMatch(/1\s+member\b/);
      expect(alpha.textContent).toMatch(/2\s+counters/);
      expect(alpha.textContent).toMatch(/0\s+dashboards/);
      expect(alpha.textContent).toContain("Owner");

      const beta = screen.getByRole("link", { name: /Beta/ });
      expect(beta.textContent).toMatch(/4\s+members/);
      expect(beta.textContent).toMatch(/1\s+counter\b/);
      expect(beta.textContent).toMatch(/3\s+dashboards/);
      expect(beta.textContent).toContain("Viewer");
    });
  });

  describe("create modal", () => {
    it("requires a non-blank name without calling the API", async () => {
      renderPage();

      const dialog = await openModal();
      await submit(dialog, "   ");

      expect(within(dialog).getByRole("alert").textContent).toContain(
        "Name is required",
      );
      expect(
        within(dialog).getByLabelText("Name").getAttribute("aria-invalid"),
      ).toBe("true");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends trimmed values, omitting a blank description, and navigates to the new team", async () => {
      respond(201, { id: "team-9", name: "New Team" });
      renderPage();

      const dialog = await openModal();
      await submit(dialog, "  New Team  ", "   ");

      await waitFor(() =>
        expect(mockGoto).toHaveBeenCalledWith("/t/team-9/new-team"),
      );
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/teams");
      expect(JSON.parse(init.body as string)).toEqual({ name: "New Team" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("includes a trimmed description when provided", async () => {
      respond(201, { id: "team-9", name: "New Team" });
      renderPage();

      const dialog = await openModal();
      await submit(dialog, "New Team", "  About us ");

      await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        name: "New Team",
        description: "About us",
      });
    });

    it("shows a rate limit message with the retry delay on 429", async () => {
      respond(429, { retryAfterSeconds: 42 });
      renderPage();

      const dialog = await openModal();
      await submit(dialog, "Team");

      expect((await within(dialog).findByRole("alert")).textContent).toContain(
        "You're creating teams too quickly. Please wait 42s and try again.",
      );
      expect(mockGoto).not.toHaveBeenCalled();
    });

    it("defaults the 429 retry delay to 60s", async () => {
      respond(429, {});
      renderPage();

      const dialog = await openModal();
      await submit(dialog, "Team");

      expect((await within(dialog).findByRole("alert")).textContent).toContain(
        "Please wait 60s",
      );
    });

    it("shows field errors from the API next to their inputs", async () => {
      respond(400, {
        errors: { name: ["Name is too long"], description: ["Too wordy"] },
      });
      renderPage();

      const dialog = await openModal();
      await submit(dialog, "Team", "Desc");

      await within(dialog).findByText("Name is too long");
      expect(
        within(dialog).getByLabelText("Name").getAttribute("aria-describedby"),
      ).toBe("create-team-name-error");
      expect(
        within(dialog)
          .getByLabelText(/Description/)
          .getAttribute("aria-describedby"),
      ).toBe("create-team-description-error");
      expect(within(dialog).getByText("Too wordy")).toBeTruthy();
    });

    it.each([
      [{ error: "Server exploded" }, "Server exploded"],
      [{ message: "Bad request" }, "Bad request"],
      [{}, "Failed to create team."],
    ])("shows a general API error %j", async (body, text) => {
      respond(500, body);
      renderPage();

      const dialog = await openModal();
      await submit(dialog, "Team");

      expect((await within(dialog).findByRole("alert")).textContent).toContain(
        text,
      );
    });

    it("shows a network error when the request fails", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      renderPage();

      const dialog = await openModal();
      await submit(dialog, "Team");

      expect((await within(dialog).findByRole("alert")).textContent).toContain(
        "Network error. Please try again.",
      );
    });

    it("resets fields and errors when reopened", async () => {
      renderPage();

      let dialog = await openModal();
      await submit(dialog, "  ");
      await fireEvent.click(
        within(dialog).getByRole("button", { name: "Cancel" }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();

      dialog = await openModal();
      expect(within(dialog).queryByRole("alert")).toBeNull();
      expect(
        (within(dialog).getByLabelText("Name") as HTMLInputElement).value,
      ).toBe("");
    });
  });
});
