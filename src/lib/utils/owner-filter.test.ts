import { describe, expect, it } from "vitest";
import { collectTeams, matchesOwnerFilter } from "./owner-filter";

describe("collectTeams", () => {
  it("returns unique teams sorted by name and skips personal items", () => {
    expect(
      collectTeams([
        { teamId: "t2", teamName: "Beta" },
        { teamId: null, teamName: null },
        { teamId: "t1", teamName: "Alpha" },
        { teamId: "t2", teamName: "Beta" },
        {},
      ]),
    ).toEqual([
      { id: "t1", name: "Alpha" },
      { id: "t2", name: "Beta" },
    ]);
  });
});

describe("matchesOwnerFilter", () => {
  const personal = { teamId: null };
  const team = { teamId: "t1" };

  it("matches everything for 'all'", () => {
    expect(matchesOwnerFilter(personal, "all")).toBe(true);
    expect(matchesOwnerFilter(team, "all")).toBe(true);
  });

  it("matches only items without a team for 'personal'", () => {
    expect(matchesOwnerFilter(personal, "personal")).toBe(true);
    expect(matchesOwnerFilter({}, "personal")).toBe(true);
    expect(matchesOwnerFilter(team, "personal")).toBe(false);
  });

  it("matches only items of the given team", () => {
    expect(matchesOwnerFilter(team, "t1")).toBe(true);
    expect(matchesOwnerFilter(team, "t2")).toBe(false);
    expect(matchesOwnerFilter(personal, "t1")).toBe(false);
  });
});
