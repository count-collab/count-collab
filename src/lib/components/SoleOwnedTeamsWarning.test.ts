import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import SoleOwnedTeamsWarning from "./SoleOwnedTeamsWarning.svelte";

function team(
  overrides: Partial<{
    id: string;
    name: string;
    memberCount: number;
    counterCount: number;
    dashboardCount: number;
  }> = {},
) {
  return {
    id: "team-1",
    name: "Alpha",
    memberCount: 3,
    counterCount: 2,
    dashboardCount: 0,
    ...overrides,
  };
}

describe("SoleOwnedTeamsWarning", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses singular wording for a single team when the user is the actor", () => {
    render(SoleOwnedTeamsWarning, { props: { teams: [team()] } });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(
      /You are the only owner of this team\. It will be deleted:/,
    );
  });

  it("uses plural wording for multiple teams and third person when not self", () => {
    render(SoleOwnedTeamsWarning, {
      props: {
        teams: [team(), team({ id: "team-2", name: "Beta" })],
        isSelf: false,
      },
    });

    expect(screen.getByRole("alert").textContent).toMatch(
      /This user is the only owner of these teams\. They will be deleted:/,
    );
  });

  it("links each team to its page", () => {
    render(SoleOwnedTeamsWarning, {
      props: { teams: [team(), team({ id: "team-2", name: "Beta" })] },
    });

    expect(
      screen.getByRole("link", { name: "Alpha" }).getAttribute("href"),
    ).toBe("/t/team-1");
    expect(
      screen.getByRole("link", { name: "Beta" }).getAttribute("href"),
    ).toBe("/t/team-2");
  });

  it("pluralises member, counter and dashboard counts", () => {
    render(SoleOwnedTeamsWarning, {
      props: {
        teams: [
          team({ memberCount: 1, counterCount: 1, dashboardCount: 1 }),
          team({
            id: "team-2",
            name: "Beta",
            memberCount: 0,
            counterCount: 5,
            dashboardCount: 2,
          }),
        ],
      },
    });

    const [first, second] = screen.getAllByRole("listitem");
    expect(first.textContent).toMatch(/1 member, 1 counter, 1 dashboard will/);
    expect(second.textContent).toMatch(
      /0 members, 5 counters, 2 dashboards will/,
    );
  });
});
