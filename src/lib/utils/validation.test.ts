import { describe, expect, it } from "vitest";
import {
  addDashboardItemSchema,
  counterMemberRoleEnum,
  counterModeEnum,
  createCounterSchema,
  createDashboardSchema,
  dashboardMemberRoleEnum,
  incrementCounterSchema,
  updateCounterSchema,
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
