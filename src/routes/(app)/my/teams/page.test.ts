import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return { page: readable({ url: new URL("http://localhost/my/teams") }) };
});

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

describe("My teams page", () => {
  afterEach(() => {
    cleanup();
  });

  describe("team list", () => {
    it("links the header create button to the team wizard", () => {
      renderPage([team()]);

      const link = screen.getByRole("link", { name: "Create team" });
      expect(link.getAttribute("href")).toBe("/create?type=team");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("shows an empty state that links to the team wizard", () => {
      renderPage();

      const link = screen.getByRole("link", { name: "Create your first team" });
      expect(link.getAttribute("href")).toBe("/create?type=team");
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
});
