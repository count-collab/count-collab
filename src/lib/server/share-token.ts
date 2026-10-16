import { tokensEqual } from "$lib/server/crypto";

/**
 * True only for private resources whose stored token matches the provided one.
 * Tokens on public resources are ignored so a stale link never changes semantics.
 */
export function hasValidShareToken(
  resource: { visibilityMode: string; shareToken: string | null | undefined },
  provided: string | null | undefined,
): boolean {
  return (
    resource.visibilityMode === "private" &&
    !!provided &&
    !!resource.shareToken &&
    tokensEqual(resource.shareToken, provided)
  );
}
