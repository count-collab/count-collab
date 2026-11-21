<script lang="ts">
  import {
    cycleTheme,
    getResolvedTheme,
    getThemePreference,
  } from "$lib/stores/theme.svelte";

  let { variant = "icon" }: { variant?: "icon" | "menu" } = $props();

  const iconName = $derived.by(() => {
    const pref = getThemePreference();
    if (pref === "light") return "sunny-outline";
    if (pref === "dark") return "moon-outline";
    return "desktop-outline";
  });

  const tooltipLabel = $derived.by(() => {
    const pref = getThemePreference();
    if (pref === "light") return "Theme: Light";
    if (pref === "dark") return "Theme: Dark";
    return "Theme: Auto";
  });

  // Ensure the dark class is in sync when this component mounts
  const _ = $derived(getResolvedTheme());
</script>

<button
  type="button"
  onclick={cycleTheme}
  class={variant === "menu"
    ? "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
    : "inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"}
  title={tooltipLabel}
  aria-label={tooltipLabel}
>
  <ion-icon name={iconName} style="font-size: 20px;"></ion-icon>
  {#if variant === "menu"}
    <span>{tooltipLabel}</span>
  {/if}
</button>
