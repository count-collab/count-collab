export type OAuthProfile = Record<string, unknown> | undefined;

/** Whether the provider vouches for the profile's email (fails closed). */
export function isProviderEmailVerified(
  provider: string | undefined,
  profile: OAuthProfile,
): boolean {
  if (!profile) return false;
  const email = profile.email;
  if (typeof email !== "string" || email.length === 0) return false;

  switch (provider) {
    case "google":
      return profile.email_verified === true;
    case "discord":
      return profile.verified === true;
    case "twitch":
      // Twitch only returns an email once it is verified.
      return true;
    default:
      return false;
  }
}

/**
 * Sign-in is allowed when the email is verified, or when this provider
 * account is already linked to a user (so existing accounts are never locked out).
 */
export async function shouldAllowSignIn(args: {
  provider: string | undefined;
  profile: OAuthProfile;
  hasLinkedAccount: () => Promise<boolean>;
}): Promise<boolean> {
  if (isProviderEmailVerified(args.provider, args.profile)) return true;
  return args.hasLinkedAccount();
}
