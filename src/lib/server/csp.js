/**
 * Content-Security-Policy directives for `kit.csp` (mode "auto" adds nonces/hashes to SvelteKit's inline scripts).
 * Plain JS so svelte.config.js can import it.
 * @param {boolean} production
 * @returns {Record<string, string[] | boolean>}
 */
export function buildCspDirectives(production) {
  return {
    "default-src": ["self"],
    // PostHog is reached through the same-origin /ingest proxy only.
    "script-src": ["self"],
    "style-src": ["self", "unsafe-inline"],
    // Avatar hosts of the OAuth providers: Google, Discord, Twitch.
    "img-src": [
      "self",
      "data:",
      "https://*.googleusercontent.com",
      "https://cdn.discordapp.com",
      "https://static-cdn.jtvnw.net",
    ],
    "font-src": ["self", "data:"],
    // ws:/wss: cover the same-origin Socket.IO connection (and Vite HMR in dev).
    "connect-src": ["self", "ws:", "wss:"],
    "worker-src": ["self", "blob:"],
    "frame-ancestors": ["none"],
    "base-uri": ["self"],
    // Auth.js signIn posts to /auth/signin/<provider> and is redirected to the provider.
    "form-action": [
      "self",
      "https://accounts.google.com",
      "https://discord.com",
      "https://id.twitch.tv",
    ],
    "object-src": ["none"],
    ...(production ? { "upgrade-insecure-requests": true } : {}),
  };
}

export const cspConfig = {
  mode: /** @type {const} */ ("auto"),
  directives: buildCspDirectives(process.env.NODE_ENV === "production"),
};
