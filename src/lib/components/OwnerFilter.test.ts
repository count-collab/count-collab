import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import OwnerFilterTestWrapper from "./OwnerFilterTestWrapper.svelte";

const teams = [
  { id: "team-1", name: "Alpha" },
  { id: "team-2", name: "Beta" },
];

function pressed(name: string) {
  return screen.getByRole("button", { name }).getAttribute("aria-pressed");
}

describe("OwnerFilter", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders All and Personal before one option per team", () => {
    render(OwnerFilterTestWrapper, { props: { teams } });

    const labels = screen
      .getAllByRole("button")
      .map((b) => b.textContent?.trim());
    expect(labels).toEqual(["All", "Personal", "Alpha", "Beta"]);
  });

  it("renders only All and Personal when there are no teams", () => {
    render(OwnerFilterTestWrapper, { props: { teams: [] } });

    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("marks the current value as pressed", () => {
    render(OwnerFilterTestWrapper, { props: { teams, value: "team-2" } });

    expect(pressed("Beta")).toBe("true");
    expect(pressed("All")).toBe("false");
    expect(pressed("Personal")).toBe("false");
  });

  it("binds the team id when a team option is clicked", async () => {
    render(OwnerFilterTestWrapper, { props: { teams } });

    await fireEvent.click(screen.getByRole("button", { name: "Alpha" }));

    expect(screen.getByTestId("selected").textContent).toBe("team-1");
    expect(pressed("Alpha")).toBe("true");
    expect(pressed("All")).toBe("false");
  });

  it("binds 'personal' when Personal is clicked", async () => {
    render(OwnerFilterTestWrapper, { props: { teams, value: "team-1" } });

    await fireEvent.click(screen.getByRole("button", { name: "Personal" }));

    expect(screen.getByTestId("selected").textContent).toBe("personal");
  });

  it("shows a team icon only on team options", () => {
    const { container } = render(OwnerFilterTestWrapper, { props: { teams } });

    expect(container.querySelectorAll("ion-icon")).toHaveLength(teams.length);
  });
});
