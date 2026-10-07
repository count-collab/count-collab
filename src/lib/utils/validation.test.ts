import { describe, expect, it } from "vitest";
import {
  addDashboardItemSchema,
  counterMemberRoleEnum,
  counterModeEnum,
  createCounterSchema,
  createDashboardSchema,
  createGoalSchema,
  createTeamSchema,
  dashboardMemberRoleEnum,
  deleteTeamSchema,
  incrementCounterSchema,
  joinLinkRoleSchema,
  joinTeamSchema,
  teamIdSchema,
  teamInviteSchema,
  teamRoleSchema,
  transferSchema,
  updateCounterSchema,
  updateDashboardSchema,
  updateGlobalSettingsSchema,
  updateGoalSchema,
  updateTeamSchema,
} from "./validation";

describe("counter visibility validation", () => {
  it("accepts public_readonly during counter creation", () => {
    const result = createCounterSchema.parse({
      title: "Read only counter",
      visibility: "public_readonly",
    });

    expect(result.visibility).toBe("public_readonly");
  });

  it("accepts public_readonly during counter updates", () => {
    const result = updateCounterSchema.parse({
      visibility: "public_readonly",
    });

    expect(result.visibility).toBe("public_readonly");
  });
});

describe("counter member role validation", () => {
  it("accepts incrementer as a valid member role", () => {
    expect(counterMemberRoleEnum.parse("incrementer")).toBe("incrementer");
  });
});

describe("counterMode validation", () => {
  describe("counterModeEnum", () => {
    it("accepts increment_only", () => {
      expect(counterModeEnum.parse("increment_only")).toBe("increment_only");
    });

    it("accepts decrement_only", () => {
      expect(counterModeEnum.parse("decrement_only")).toBe("decrement_only");
    });

    it("accepts both", () => {
      expect(counterModeEnum.parse("both")).toBe("both");
    });

    it("rejects invalid value", () => {
      expect(() => counterModeEnum.parse("invalid")).toThrow();
    });
  });

  describe("createCounterSchema counterMode", () => {
    it("accepts counterMode: 'both'", () => {
      const result = createCounterSchema.parse({
        title: "Test",
        counterMode: "both",
      });
      expect(result.counterMode).toBe("both");
    });

    it("rejects counterMode: 'invalid'", () => {
      expect(() =>
        createCounterSchema.parse({
          title: "Test",
          counterMode: "invalid",
        }),
      ).toThrow();
    });

    it("defaults counterMode to increment_only", () => {
      const result = createCounterSchema.parse({ title: "Test" });
      expect(result.counterMode).toBe("increment_only");
    });
  });

  describe("updateCounterSchema counterMode", () => {
    it("accepts counterMode: 'decrement_only'", () => {
      const result = updateCounterSchema.parse({
        counterMode: "decrement_only",
      });
      expect(result.counterMode).toBe("decrement_only");
    });

    it("allows omitting counterMode", () => {
      const result = updateCounterSchema.parse({ title: "Updated" });
      expect(result.counterMode).toBeUndefined();
    });
  });
});

describe("incrementCounterSchema", () => {
  it("allows positive amount", () => {
    const result = incrementCounterSchema.parse({ amount: 1 });
    expect(result.amount).toBe(1);
  });

  it("allows negative amount", () => {
    const result = incrementCounterSchema.parse({ amount: -1 });
    expect(result.amount).toBe(-1);
  });

  it("rejects amount of 0", () => {
    expect(() => incrementCounterSchema.parse({ amount: 0 })).toThrow();
  });

  it("defaults amount to 1 when omitted", () => {
    const result = incrementCounterSchema.parse({});
    expect(result.amount).toBe(1);
  });

  it("rejects non-integer amount", () => {
    expect(() => incrementCounterSchema.parse({ amount: 1.5 })).toThrow();
  });
});

describe("dashboard validation", () => {
  describe("createDashboardSchema", () => {
    it("accepts valid dashboard creation input", () => {
      const result = createDashboardSchema.parse({
        title: "My Dashboard",
        description: "A test dashboard",
        visibility: "public",
      });
      expect(result.title).toBe("My Dashboard");
      expect(result.visibility).toBe("public");
    });

    it("rejects empty title", () => {
      expect(() => createDashboardSchema.parse({ title: "" })).toThrow();
    });

    it("accepts all visibility modes", () => {
      for (const vis of ["public", "private"]) {
        const result = createDashboardSchema.parse({
          title: "Test",
          visibility: vis,
        });
        expect(result.visibility).toBe(vis);
      }
    });

    it("defaults visibility to public", () => {
      const result = createDashboardSchema.parse({ title: "Test" });
      expect(result.visibility).toBe("public");
    });

    it("accepts an optional uuid teamId", () => {
      const teamId = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
      expect(createDashboardSchema.parse({ title: "T", teamId }).teamId).toBe(
        teamId,
      );
      expect(
        createDashboardSchema.parse({ title: "T" }).teamId,
      ).toBeUndefined();
      expect(() =>
        createDashboardSchema.parse({ title: "T", teamId: "nope" }),
      ).toThrow();
    });
  });

  describe("dashboardMemberRoleEnum", () => {
    it("accepts viewer, editor, admin", () => {
      for (const role of ["viewer", "editor", "admin"]) {
        expect(dashboardMemberRoleEnum.parse(role)).toBe(role);
      }
    });

    it("rejects incrementer (not a dashboard role)", () => {
      expect(() => dashboardMemberRoleEnum.parse("incrementer")).toThrow();
    });
  });

  describe("updateDashboardSchema gridColumns", () => {
    it("is optional", () => {
      expect(
        updateDashboardSchema.parse({ title: "T" }).gridColumns,
      ).toBeUndefined();
    });

    it("accepts 2 through 5", () => {
      for (const gridColumns of [2, 3, 4, 5]) {
        expect(updateDashboardSchema.parse({ gridColumns }).gridColumns).toBe(
          gridColumns,
        );
      }
    });

    it("rejects out-of-range and non-integer values", () => {
      for (const gridColumns of [1, 6, 0, 3.5, "3"]) {
        expect(updateDashboardSchema.safeParse({ gridColumns }).success).toBe(
          false,
        );
      }
    });
  });

  describe("addDashboardItemSchema", () => {
    it("accepts valid item placement", () => {
      const result = addDashboardItemSchema.parse({
        counterId: "550e8400-e29b-41d4-a716-446655440000",
        positionX: 0,
        positionY: 0,
      });
      expect(result.sizeColumns).toBe(1);
      expect(result.sizeRows).toBe(1);
    });

    it("rejects positionX > 4", () => {
      expect(() =>
        addDashboardItemSchema.parse({
          counterId: "550e8400-e29b-41d4-a716-446655440000",
          positionX: 5,
          positionY: 0,
        }),
      ).toThrow();
    });

    it("rejects sizeRows > 4", () => {
      expect(() =>
        addDashboardItemSchema.parse({
          counterId: "550e8400-e29b-41d4-a716-446655440000",
          positionX: 0,
          positionY: 0,
          sizeRows: 5,
        }),
      ).toThrow();
    });
  });
});

describe("updateCounterSchema counter settings extensions", () => {
  it("accepts cooldownEnabled as boolean", () => {
    const result = updateCounterSchema.parse({ cooldownEnabled: true });
    expect(result.cooldownEnabled).toBe(true);
  });

  it("accepts cooldownSeconds as integer 1-60", () => {
    const result = updateCounterSchema.parse({ cooldownSeconds: 30 });
    expect(result.cooldownSeconds).toBe(30);
  });

  it("rejects cooldownSeconds less than 1", () => {
    expect(() => updateCounterSchema.parse({ cooldownSeconds: 0 })).toThrow();
  });

  it("rejects cooldownSeconds greater than 60", () => {
    expect(() => updateCounterSchema.parse({ cooldownSeconds: 61 })).toThrow();
  });

  it("rejects non-integer cooldownSeconds", () => {
    expect(() => updateCounterSchema.parse({ cooldownSeconds: 5.5 })).toThrow();
  });

  it("accepts goalsEnabled as boolean", () => {
    const result = updateCounterSchema.parse({ goalsEnabled: true });
    expect(result.goalsEnabled).toBe(true);
  });

  it("accepts scoreboardEnabled as boolean", () => {
    const result = updateCounterSchema.parse({ scoreboardEnabled: false });
    expect(result.scoreboardEnabled).toBe(false);
  });

  it("all new fields are optional", () => {
    const result = updateCounterSchema.parse({ title: "Only title" });
    expect(result.cooldownEnabled).toBeUndefined();
    expect(result.cooldownSeconds).toBeUndefined();
    expect(result.goalsEnabled).toBeUndefined();
    expect(result.scoreboardEnabled).toBeUndefined();
  });
});

describe("createGoalSchema", () => {
  it("accepts valid goal", () => {
    const result = createGoalSchema.parse({
      amount: 100,
      description: "Pizza party",
    });
    expect(result.amount).toBe(100);
    expect(result.description).toBe("Pizza party");
  });

  it("rejects missing amount", () => {
    expect(() =>
      createGoalSchema.parse({ description: "Pizza party" }),
    ).toThrow();
  });

  it("rejects missing description", () => {
    const result = createGoalSchema.parse({ amount: 100 });
    expect(result.description).toBe("");
  });

  it("accepts empty description", () => {
    const result = createGoalSchema.parse({ amount: 100, description: "" });
    expect(result.description).toBe("");
  });

  it("rejects description longer than 200 chars", () => {
    expect(() =>
      createGoalSchema.parse({ amount: 100, description: "x".repeat(201) }),
    ).toThrow();
  });

  it("trims description whitespace", () => {
    const result = createGoalSchema.parse({
      amount: 50,
      description: "  trimmed  ",
    });
    expect(result.description).toBe("trimmed");
  });

  it("accepts negative amounts (for decrement counters)", () => {
    const result = createGoalSchema.parse({
      amount: -50,
      description: "Countdown goal",
    });
    expect(result.amount).toBe(-50);
  });
});

describe("updateGoalSchema", () => {
  it("accepts partial updates (just amount)", () => {
    const result = updateGoalSchema.parse({ amount: 200 });
    expect(result.amount).toBe(200);
    expect(result.description).toBeUndefined();
  });

  it("accepts partial updates (just description)", () => {
    const result = updateGoalSchema.parse({ description: "Updated" });
    expect(result.description).toBe("Updated");
    expect(result.amount).toBeUndefined();
  });

  it("accepts empty object", () => {
    const result = updateGoalSchema.parse({});
    expect(result.amount).toBeUndefined();
    expect(result.description).toBeUndefined();
  });
});

describe("counter description validation", () => {
  describe("createCounterSchema", () => {
    it("accepts descriptions at exactly 500 characters", () => {
      const result = createCounterSchema.parse({
        title: "Test",
        description: "a".repeat(500),
      });
      expect(result.description).toBe("a".repeat(500));
    });

    it("rejects descriptions over 500 characters", () => {
      expect(() =>
        createCounterSchema.parse({
          title: "Test",
          description: "a".repeat(501),
        }),
      ).toThrow("Description must be less than 500 characters");
    });

    it("accepts empty description", () => {
      const result = createCounterSchema.parse({ title: "Test" });
      expect(result.description).toBe("");
    });

    it("accepts an optional uuid teamId", () => {
      const teamId = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
      expect(createCounterSchema.parse({ title: "T", teamId }).teamId).toBe(
        teamId,
      );
      expect(createCounterSchema.parse({ title: "T" }).teamId).toBeUndefined();
      expect(() =>
        createCounterSchema.parse({ title: "T", teamId: "nope" }),
      ).toThrow();
    });
  });

  describe("updateCounterSchema", () => {
    it("accepts descriptions at exactly 500 characters", () => {
      const result = updateCounterSchema.parse({
        description: "a".repeat(500),
      });
      expect(result.description).toBe("a".repeat(500));
    });

    it("rejects descriptions over 500 characters", () => {
      expect(() =>
        updateCounterSchema.parse({
          description: "a".repeat(501),
        }),
      ).toThrow("Description must be less than 500 characters");
    });

    it("allows omitting description", () => {
      const result = updateCounterSchema.parse({ title: "Test" });
      expect(result.description).toBeUndefined();
    });
  });
});

describe("updateGlobalSettingsSchema", () => {
  it("accepts valid partial updates", () => {
    const result = updateGlobalSettingsSchema.parse({
      counterCreationLimitAuth: 10,
      incrementCooldownMsAuth: 3000,
    });
    expect(result.counterCreationLimitAuth).toBe(10);
    expect(result.incrementCooldownMsAuth).toBe(3000);
  });

  it("rejects negative values", () => {
    expect(() =>
      updateGlobalSettingsSchema.parse({ counterCreationLimitAuth: -1 }),
    ).toThrow();
  });

  it("rejects non-integer values", () => {
    expect(() =>
      updateGlobalSettingsSchema.parse({ incrementCooldownMsAuth: 5.5 }),
    ).toThrow();
  });

  it("all fields are optional", () => {
    const result = updateGlobalSettingsSchema.parse({});
    expect(result.counterCreationLimitAuth).toBeUndefined();
    expect(result.counterCreationWindowAuth).toBeUndefined();
    expect(result.incrementCooldownMsAuth).toBeUndefined();
    expect(result.incrementCooldownMsUnauth).toBeUndefined();
  });

  it("rejects zero values", () => {
    expect(() =>
      updateGlobalSettingsSchema.parse({ counterCreationLimitAuth: 0 }),
    ).toThrow();
  });

  it("accepts team creation limit and window", () => {
    const result = updateGlobalSettingsSchema.parse({
      teamCreationLimitAuth: 5,
      teamCreationWindowAuth: 120,
    });
    expect(result.teamCreationLimitAuth).toBe(5);
    expect(result.teamCreationWindowAuth).toBe(120);
  });

  it.each([0, -1, 2.5])(
    "rejects invalid team creation values (%s)",
    (value) => {
      expect(() =>
        updateGlobalSettingsSchema.parse({ teamCreationLimitAuth: value }),
      ).toThrow();
      expect(() =>
        updateGlobalSettingsSchema.parse({ teamCreationWindowAuth: value }),
      ).toThrow();
    },
  );
});

describe("team validation", () => {
  const UUID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

  describe("teamIdSchema", () => {
    it("accepts a uuid", () => {
      expect(teamIdSchema.safeParse(UUID).success).toBe(true);
    });

    it("rejects a non-uuid", () => {
      expect(teamIdSchema.safeParse("abc").success).toBe(false);
    });
  });

  describe("createTeamSchema", () => {
    it("trims the name", () => {
      expect(createTeamSchema.parse({ name: "  Team  " }).name).toBe("Team");
    });

    it("rejects a blank name", () => {
      expect(createTeamSchema.safeParse({ name: "   " }).success).toBe(false);
    });

    it("accepts 50 chars and rejects 51", () => {
      expect(createTeamSchema.safeParse({ name: "a".repeat(50) }).success).toBe(
        true,
      );
      expect(createTeamSchema.safeParse({ name: "a".repeat(51) }).success).toBe(
        false,
      );
    });

    it("turns an empty description into null", () => {
      expect(
        createTeamSchema.parse({ name: "Team", description: "  " }).description,
      ).toBeNull();
    });

    it("rejects a description over 500 chars", () => {
      expect(
        createTeamSchema.safeParse({
          name: "Team",
          description: "a".repeat(501),
        }).success,
      ).toBe(false);
    });
  });

  describe("updateTeamSchema", () => {
    it("accepts an empty object", () => {
      expect(updateTeamSchema.parse({})).toEqual({});
    });

    it("leaves an omitted description undefined", () => {
      const result = updateTeamSchema.parse({ name: "New" });
      expect(result.description).toBeUndefined();
    });

    it("clears the description with an empty string", () => {
      expect(
        updateTeamSchema.parse({ description: "" }).description,
      ).toBeNull();
    });

    it("still validates the name", () => {
      expect(updateTeamSchema.safeParse({ name: "" }).success).toBe(false);
    });
  });

  describe("teamInviteSchema", () => {
    it("accepts owner as a role", () => {
      expect(
        teamInviteSchema.parse({ username: "Bob", role: "owner" }),
      ).toEqual({ username: "bob", role: "owner" });
    });

    it("rejects unknown roles", () => {
      expect(
        teamInviteSchema.safeParse({ username: "bob", role: "god" }).success,
      ).toBe(false);
    });
  });

  describe("teamRoleSchema", () => {
    it("accepts every team role", () => {
      for (const role of [
        "viewer",
        "incrementer",
        "editor",
        "admin",
        "owner",
      ]) {
        expect(teamRoleSchema.safeParse({ role }).success).toBe(true);
      }
    });
  });

  describe("joinLinkRoleSchema", () => {
    it("accepts up to editor", () => {
      expect(joinLinkRoleSchema.safeParse({ role: "editor" }).success).toBe(
        true,
      );
    });

    it("rejects admin and owner", () => {
      expect(joinLinkRoleSchema.safeParse({ role: "admin" }).success).toBe(
        false,
      );
      expect(joinLinkRoleSchema.safeParse({ role: "owner" }).success).toBe(
        false,
      );
    });
  });

  describe("joinTeamSchema", () => {
    it("requires a non-empty token", () => {
      expect(joinTeamSchema.safeParse({ token: "" }).success).toBe(false);
      expect(joinTeamSchema.safeParse({ token: "abc" }).success).toBe(true);
    });
  });

  describe("deleteTeamSchema", () => {
    it("requires confirmName", () => {
      expect(deleteTeamSchema.safeParse({}).success).toBe(false);
      expect(deleteTeamSchema.parse({ confirmName: "Team" })).toEqual({
        confirmName: "Team",
      });
    });
  });

  describe("transferSchema", () => {
    it("defaults counterIds to an empty array", () => {
      expect(transferSchema.parse({ teamId: UUID })).toEqual({
        teamId: UUID,
        counterIds: [],
      });
    });

    it("accepts a null teamId", () => {
      expect(transferSchema.safeParse({ teamId: null }).success).toBe(true);
    });

    it("requires teamId to be present", () => {
      expect(transferSchema.safeParse({}).success).toBe(false);
    });

    it("rejects non-uuid counter ids", () => {
      expect(
        transferSchema.safeParse({ teamId: UUID, counterIds: ["x"] }).success,
      ).toBe(false);
    });

    it("rejects more than 100 counter ids", () => {
      expect(
        transferSchema.safeParse({
          teamId: UUID,
          counterIds: Array(101).fill(UUID),
        }).success,
      ).toBe(false);
    });
  });
});
