import { describe, expect, it } from "vitest";
import {
  counterMemberRoleEnum,
  createCounterSchema,
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
