<script lang="ts">
  import type { Snippet } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import { lockBodyScroll } from "$lib/utils/scroll-lock";

  let {
    open = $bindable(),
    title,
    children,
    maxWidth = "max-w-lg",
    describedBy,
    onclose,
  }: {
    open: boolean;
    title: string;
    children: Snippet;
    maxWidth?: string;
    describedBy?: string;
    onclose?: () => void;
  } = $props();

  let titleId = $derived(
    `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-title`,
  );

  function close() {
    open = false;
    onclose?.();
  }

  $effect(() => {
    if (!open) return;
    return lockBodyScroll();
  });
</script>

<!-- Capture phase runs before any bubble listener, so outer overlays never see this Escape -->
<svelte:window
  onkeydowncapture={(e) => {
    if (!open || e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }}
/>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions, a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4 dark:bg-slate-950/70"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={describedBy}
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) close();
    }}
    in:fade={{ duration: 150 }}
  >
    <div
      class="w-full {maxWidth} max-sm:max-w-none max-h-[90vh] overflow-y-auto rounded-t-2xl border border-b-0 border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-2xl sm:border-b dark:border-slate-700 dark:bg-slate-900"
      in:fly={{ y: 16, duration: 200, easing: cubicOut }}
    >
      <div
        class="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700"
      >
        <h2
          id={titleId}
          class="text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          {title}
        </h2>
        <button
          type="button"
          onclick={close}
          class="-mr-1.5 p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <ion-icon
            name="close-outline"
            class="block"
            style="font-size: 24px;"
            aria-hidden="true"
          ></ion-icon>
        </button>
      </div>
      <div class="px-6 py-5 space-y-4">
        {@render children()}
      </div>
    </div>
  </div>
{/if}
