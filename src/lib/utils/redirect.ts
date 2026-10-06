const SENTINEL_ORIGIN = "http://localhost";

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** Returns `value` if it is a same-origin relative path, otherwise `fallback`. */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return fallback;
  if (value.includes("\\") || hasControlCharacters(value)) return fallback;

  // Defence in depth: the browser must resolve it to the same origin.
  try {
    if (new URL(value, SENTINEL_ORIGIN).origin !== SENTINEL_ORIGIN)
      return fallback;
  } catch {
    return fallback;
  }

  return value;
}
