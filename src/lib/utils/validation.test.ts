import { describe, expect, it } from "vitest";
import {
  addDashboardItemSchema,
  counterMemberRoleEnum,
  counterModeEnum,
  createCounterSchema,
  createDashboardSchema,
  createGoalSchema,
  dashboardMemberRoleEnum,
  incrementCounterSchema,
  updateCounterSchema,
  updateGlobalSettingsSchema,
  updateGoalSchema,
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
});
