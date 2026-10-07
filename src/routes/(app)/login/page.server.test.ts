import { describe, expect, it, vi } from "vitest";
import { load } from "./+page.server";

function callLoad(loggedIn: boolean, search = "") {
  return load({
    url: new URL(`http://localhost/login${search}`),
    locals: {
      auth: vi.fn(async () => (loggedIn ? { user: { id: "user-1" } } : null)),
    },
  } as unknown as Parameters<typeof load>[0]);
}

describe("/login load", () => {
  it("returns null redirectTo when none is given", async () => {
    expect(await callLoad(false)).toEqual({ redirectTo: null });
  });

  it("returns a sanitized redirectTo for anonymous users", async () => {
    const target = "/t/abc/join?token=xyz";
    expect(
      await callLoad(false, `?redirectTo=${encodeURIComponent(target)}`),
    ).toEqual({
      redirectTo: target,
    });
  });

  it("drops unsafe redirectTo values for anonymous users", async () => {
    expect(
      await callLoad(false, `?redirectTo=${encodeURIComponent("//evil.com")}`),
    ).toEqual({
      redirectTo: null,
    });
  });

  it("redirects logged-in users to /home by default", async () => {
    await expect(callLoad(true)).rejects.toMatchObject({
      status: 303,
      location: "/home",
    });
  });

  it("redirects logged-in users to a safe redirectTo", async () => {
    const target = "/t/abc/join?token=xyz";
    await expect(
      callLoad(true, `?redirectTo=${encodeURIComponent(target)}`),
    ).rejects.toMatchObject({ status: 303, location: target });
  });

  it("ignores unsafe redirectTo for logged-in users", async () => {
    await expect(
      callLoad(true, `?redirectTo=${encodeURIComponent("https://evil.com")}`),
    ).rejects.toMatchObject({ status: 303, location: "/home" });
  });
});
