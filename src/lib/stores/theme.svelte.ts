import { browser } from "$app/environment";

export type ThemePreference = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

const COOKIE_NAME = "theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(): ThemePreference {
  if (!browser) return "auto";
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`),
  );
  const value = match?.[1];
  if (value === "light" || value === "dark") return value;
  return "auto";
}

function writeCookie(value: ThemePreference) {
  if (!browser) return;
  // biome-ignore lint/suspicious/noDocumentCookie: standard cookie API, no alternative needed
  document.cookie = `${COOKIE_NAME}=${value};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

function getSystemDark(): boolean {
  if (!browser) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

let preference = $state<ThemePreference>(readCookie());
let systemDark = $state<boolean>(getSystemDark());

const resolved: ResolvedTheme = $derived(
  preference === "auto" ? (systemDark ? "dark" : "light") : preference,
);

function applyClass() {
  if (!browser) return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

// Listen for OS preference changes
if (browser) {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      systemDark = e.matches;
      applyClass();
    });

  // Apply on initial load
  applyClass();
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function getResolvedTheme(): ResolvedTheme {
  return resolved;
}

export function setTheme(value: ThemePreference) {
  preference = value;
  writeCookie(value);

  if (browser) {
    document.documentElement.classList.add("theme-transitioning");
    applyClass();
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning");
    }, 200);
  }
}

export function cycleTheme() {
  const order: ThemePreference[] = ["auto", "light", "dark"];
  const next = order[(order.indexOf(preference) + 1) % order.length];
  setTheme(next);
}
