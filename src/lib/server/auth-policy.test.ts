import { describe, expect, it, vi } from "vitest";
import { isProviderEmailVerified, shouldAllowSignIn } from "./auth-policy";

describe("isProviderEmailVerified", () => {
  it("accepts verified Google email", () => {
    expect(
      isProviderEmailVerified("google", {
        email: "a@b.com",
        email_verified: true,
      }),
    ).toBe(true);
  });

  it("rejects Google email when email_verified is false or non-boolean", () => {
    expect(
      isProviderEmailVerified("google", {
        email: "a@b.com",
        email_verified: false,
      }),
    ).toBe(false);
    expect(
      isProviderEmailVerified("google", {
        email: "a@b.com",
        email_verified: "true",
      }),
    ).toBe(false);
    expect(isProviderEmailVerified("google", { email: "a@b.com" })).toBe(false);
  });

  it("accepts verified Discord email and rejects unverified", () => {
    expect(
      isProviderEmailVerified("discord", { email: "a@b.com", verified: true }),
    ).toBe(true);
    expect(
      isProviderEmailVerified("discord", { email: "a@b.com", verified: false }),
    ).toBe(false);
    expect(isProviderEmailVerified("discord", { email: "a@b.com" })).toBe(
      false,
    );
  });

  it("accepts Twitch when an email is present and rejects when missing", () => {
    expect(isProviderEmailVerified("twitch", { email: "a@b.com" })).toBe(true);
    expect(isProviderEmailVerified("twitch", {})).toBe(false);
    expect(isProviderEmailVerified("twitch", { email: "" })).toBe(false);
  });

  it("rejects when email is missing even if flagged verified", () => {
    expect(isProviderEmailVerified("discord", { verified: true })).toBe(false);
    expect(isProviderEmailVerified("google", { email_verified: true })).toBe(
      false,
    );
  });

  it("fails closed for unknown providers and missing profile", () => {
    expect(isProviderEmailVerified("github", { email: "a@b.com" })).toBe(false);
    expect(isProviderEmailVerified(undefined, { email: "a@b.com" })).toBe(
      false,
    );
    expect(isProviderEmailVerified("google", undefined)).toBe(false);
  });
});

describe("shouldAllowSignIn", () => {
  it("allows verified email without hitting the DB", async () => {
    const hasLinkedAccount = vi.fn().mockResolvedValue(false);
    const allowed = await shouldAllowSignIn({
      provider: "discord",
      profile: { email: "a@b.com", verified: true },
      hasLinkedAccount,
    });
    expect(allowed).toBe(true);
    expect(hasLinkedAccount).not.toHaveBeenCalled();
  });

  it("rejects unverified email for an unlinked account", async () => {
    const allowed = await shouldAllowSignIn({
      provider: "discord",
      profile: { email: "victim@example.com", verified: false },
      hasLinkedAccount: async () => false,
    });
    expect(allowed).toBe(false);
  });

  it("allows unverified email for an already-linked account", async () => {
    const allowed = await shouldAllowSignIn({
      provider: "discord",
      profile: { email: "a@b.com", verified: false },
      hasLinkedAccount: async () => true,
    });
    expect(allowed).toBe(true);
  });
});
