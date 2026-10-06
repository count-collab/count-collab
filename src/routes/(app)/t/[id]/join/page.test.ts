import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGoto, mockPage, fetchMock } = vi.hoisted(() => ({
  mockGoto: vi.fn(async () => {}),
  mockPage: { url: new URL("http://localhost/t/team-1/join?token=tok-123") },
  fetchMock: vi.fn(),
}));

vi.mock("$app/navigation", () => ({ goto: mockGoto }));

vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return { page: readable(mockPage) };
});

vi.stubGlobal("fetch", fetchMock);

const { default: Page } = await import("./+page.svelte");

function renderPage(overrides: Record<string, unknown> = {}) {
  const data = {
    team: { id: "team-1", name: "The Crew" },
    role: "editor",
    alreadyMember: false,
    ...overrides,
  };
  return render(Page, { props: { data: data as any } });
}

describe("Team join page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  afterEach(() => {
    cleanup();
  });

  describe("already a member", () => {
    it("links to the team instead of offering to join", () => {
      renderPage({ alreadyMember: true });

      expect(
        screen.getByRole("heading", { name: "You're already a member" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("link", { name: /Go to team/ }).getAttribute("href"),
      ).toBe("/t/team-1/the-crew");
      expect(screen.queryByRole("button", { name: "Join team" })).toBeNull();
    });
  });

  describe("not yet a member", () => {
    it("shows the team name and the role the link grants", () => {
      renderPage({ role: "incrementer" });

      expect(
        screen.getByRole("heading", { name: "Join The Crew as Incrementer" }),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Join team" })).toBeTruthy();
    });

    it("posts the token from the URL and navigates to the team on success", async () => {
      renderPage();

      await fireEvent.click(screen.getByRole("button", { name: "Join team" }));

      await waitFor(() => expect(mockGoto).toHaveBeenCalledOnce());
      expect(fetchMock).toHaveBeenCalledWith("/api/teams/team-1/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "tok-123" }),
      });
      expect(mockGoto).toHaveBeenCalledWith("/t/team-1/the-crew", {
        invalidateAll: true,
      });
    });

    it.each([
      [{ error: "Invalid or expired link" }, "Invalid or expired link"],
      [{ message: "Team not found" }, "Team not found"],
      [{}, "Failed to join team."],
    ])("shows the API error %j and stays on the page", async (body, text) => {
      fetchMock.mockResolvedValue({ ok: false, json: async () => body });
      renderPage();

      await fireEvent.click(screen.getByRole("button", { name: "Join team" }));

      expect((await screen.findByRole("alert")).textContent).toContain(text);
      expect(mockGoto).not.toHaveBeenCalled();
      expect(
        (screen.getByRole("button", { name: "Join team" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });

    it("shows a network error when the request fails", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      renderPage();

      await fireEvent.click(screen.getByRole("button", { name: "Join team" }));

      expect((await screen.findByRole("alert")).textContent).toContain(
        "Network error. Please try again.",
      );
    });

    it("disables the button while joining and ignores repeated clicks", async () => {
      let resolve!: (value: unknown) => void;
      fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
      renderPage();

      await fireEvent.click(screen.getByRole("button", { name: "Join team" }));
      const busy = screen.getByRole("button", {
        name: "Joining…",
      }) as HTMLButtonElement;
      expect(busy.disabled).toBe(true);
      await fireEvent.click(busy);

      resolve({ ok: true, json: async () => ({}) });
      await waitFor(() => expect(mockGoto).toHaveBeenCalledOnce());
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });
});
