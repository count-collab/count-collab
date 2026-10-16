import { describe, expect, it } from "vitest";
import {
  canAssignTeamRole,
  counterRoleDescriptions,
  counterRoleRank,
  dashboardRoleDescriptions,
  dashboardRoleRank,
  isTeamRoleAtLeast,
  mapTeamRoleToCounterRole,
  mapTeamRoleToDashboardRole,
  maxCounterRole,
  maxDashboardRole,
  teamRoleDescriptions,
  teamRoleOrder,
  teamRoleRank,
} from "./roles";

describe("role descriptions", () => {
  it("describes every team role", () => {
    for (const role of teamRoleOrder) {
      expect(teamRoleDescriptions[role].length).toBeGreaterThan(0);
    }
  });

  it("describes every counter and dashboard role", () => {
    expect(Object.keys(counterRoleDescriptions)).toEqual([
      "viewer",
      "incrementer",
      "editor",
      "admin",
    ]);
    expect(Object.keys(dashboardRoleDescriptions)).toEqual([
      "viewer",
      "editor",
      "admin",
    ]);
  });
});

describe("role ranks", () => {
  it("orders roles from lowest to highest", () => {
    expect(counterRoleRank("viewer")).toBeLessThan(
      counterRoleRank("incrementer"),
    );
    expect(counterRoleRank("editor")).toBeLessThan(counterRoleRank("admin"));
    expect(dashboardRoleRank("viewer")).toBeLessThan(
      dashboardRoleRank("editor"),
    );
    expect(teamRoleRank("admin")).toBeLessThan(teamRoleRank("owner"));
  });
});

describe("team role mapping", () => {
  it("maps team roles to counter roles", () => {
    expect(mapTeamRoleToCounterRole("viewer")).toBe("viewer");
    expect(mapTeamRoleToCounterRole("incrementer")).toBe("incrementer");
    expect(mapTeamRoleToCounterRole("editor")).toBe("editor");
    expect(mapTeamRoleToCounterRole("admin")).toBe("admin");
    expect(mapTeamRoleToCounterRole("owner")).toBe("admin");
  });

  it("maps team roles to dashboard roles", () => {
    expect(mapTeamRoleToDashboardRole("viewer")).toBe("viewer");
    expect(mapTeamRoleToDashboardRole("incrementer")).toBe("viewer");
    expect(mapTeamRoleToDashboardRole("editor")).toBe("editor");
    expect(mapTeamRoleToDashboardRole("admin")).toBe("admin");
    expect(mapTeamRoleToDashboardRole("owner")).toBe("admin");
  });
});

describe("max role helpers", () => {
  it("returns the higher counter role and handles null", () => {
    expect(maxCounterRole("viewer", "editor")).toBe("editor");
    expect(maxCounterRole("admin", "incrementer")).toBe("admin");
    expect(maxCounterRole(null, "viewer")).toBe("viewer");
    expect(maxCounterRole("viewer", null)).toBe("viewer");
    expect(maxCounterRole(null, null)).toBeNull();
  });

  it("returns the higher dashboard role and handles null", () => {
    expect(maxDashboardRole("editor", "viewer")).toBe("editor");
    expect(maxDashboardRole(null, "admin")).toBe("admin");
    expect(maxDashboardRole(null, null)).toBeNull();
  });
});

describe("isTeamRoleAtLeast", () => {
  it("compares team roles", () => {
    expect(isTeamRoleAtLeast("editor", "editor")).toBe(true);
    expect(isTeamRoleAtLeast("owner", "admin")).toBe(true);
    expect(isTeamRoleAtLeast("incrementer", "editor")).toBe(false);
    expect(isTeamRoleAtLeast(null, "viewer")).toBe(false);
  });
});

describe("canAssignTeamRole", () => {
  it("rejects actors below admin", () => {
    expect(canAssignTeamRole(null, null, "viewer")).toBe(false);
    expect(canAssignTeamRole("editor", "viewer", "incrementer")).toBe(false);
  });

  it("lets admins manage non-owner roles", () => {
    expect(canAssignTeamRole("admin", null, "editor")).toBe(true);
    expect(canAssignTeamRole("admin", "viewer", "admin")).toBe(true);
    expect(canAssignTeamRole("admin", "admin", null)).toBe(true);
  });

  it("requires owner for anything involving the owner role", () => {
    expect(canAssignTeamRole("admin", null, "owner")).toBe(false);
    expect(canAssignTeamRole("admin", "owner", "admin")).toBe(false);
    expect(canAssignTeamRole("admin", "owner", null)).toBe(false);
    expect(canAssignTeamRole("owner", "admin", "owner")).toBe(true);
    expect(canAssignTeamRole("owner", "owner", null)).toBe(true);
  });

  it("rejects a no-op with neither current nor new role", () => {
    expect(canAssignTeamRole("owner", null, null)).toBe(false);
  });
});
