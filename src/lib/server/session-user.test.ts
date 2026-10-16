import { describe, expect, it } from "vitest";
import { toClientSessionUser } from "./session-user";

describe("toClientSessionUser", () => {
  const adapterUser = {
    id: "user-1",
    name: "Jane Full Name",
    email: "jane@example.com",
    image: "https://example.com/a.png",
    emailVerified: null,
  };

  it("never includes the OAuth full name", () => {
    const result = toClientSessionUser(adapterUser, {
      id: "user-1",
      username: "jane",
      roleId: 2,
    });

    expect(result).not.toHaveProperty("name");
    expect(JSON.stringify(result)).not.toContain("Jane Full Name");
  });

  it("returns only whitelisted fields", () => {
    const result = toClientSessionUser(adapterUser, {
      id: "user-1",
      username: "jane",
      roleId: 2,
    });

    expect(result).toEqual({
      id: "user-1",
      email: "jane@example.com",
      image: "https://example.com/a.png",
      username: "jane",
      roleId: 2,
    });
  });

  it("falls back to null username, not the name, when the db user is missing", () => {
    const result = toClientSessionUser(adapterUser, undefined);

    expect(result).toEqual({
      id: "user-1",
      email: "jane@example.com",
      image: "https://example.com/a.png",
      username: null,
      roleId: null,
    });
  });
});
