/**
 * Converts a counter title to a URL-safe slug.
 *
 * Examples:
 *   "My Awesome Counter" → "my-awesome-counter"
 *   "Hello World!!!" → "hello-world"
 *   "  spaced  out  " → "spaced-out"
 */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      // Strip combining diacritical marks (accents)
      .replace(/[\u0300-\u036f]/g, "")
      // Replace non-alphanumeric characters with hyphens
      .replace(/[^a-z0-9]+/g, "-")
      // Collapse multiple hyphens
      .replace(/-{2,}/g, "-")
      // Trim leading/trailing hyphens
      .replace(/^-|-$/g, "")
      // Truncate to 80 characters (break at last hyphen if possible)
      .slice(0, 80)
      .replace(/-$/, "")
  );
}

export function counterUrl(id: string, title: string): string {
  const slug = slugify(title);
  if (!slug) return `/c/${id}`;
  return `/c/${id}/${slug}`;
}
