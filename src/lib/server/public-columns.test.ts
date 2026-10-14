import { describe, expect, it } from "vitest";
import { counters, dashboards } from "$lib/db/schema";
import {
  publicCounterColumns,
  publicDashboardColumns,
  withoutShareToken,
} from "./public-columns";

describe("public column sets", () => {
  it("omit shareToken for counters while keeping every other column", () => {
    expect(publicCounterColumns).not.toHaveProperty("shareToken");
    expect(Object.values(publicCounterColumns)).not.toContain(
      counters.shareToken,
    );
    expect(publicCounterColumns).toHaveProperty("id");
    expect(publicCounterColumns).toHaveProperty("visibilityMode");
  });

  it("omit shareToken for dashboards while keeping every other column", () => {
    expect(publicDashboardColumns).not.toHaveProperty("shareToken");
    expect(Object.values(publicDashboardColumns)).not.toContain(
      dashboards.shareToken,
    );
    expect(publicDashboardColumns).toHaveProperty("id");
    expect(publicDashboardColumns).toHaveProperty("gridColumns");
  });
});

describe("withoutShareToken", () => {
  it("drops the token without mutating the input", () => {
    const row = { id: "1", shareToken: "secret", title: "T" };

    const result = withoutShareToken(row);

    expect(result).toEqual({ id: "1", title: "T" });
    expect(row.shareToken).toBe("secret");
  });

  it("is a no-op when the token is absent", () => {
    const row: { id: string; shareToken?: string } = { id: "1" };

    expect(withoutShareToken(row)).toEqual({ id: "1" });
  });
});
