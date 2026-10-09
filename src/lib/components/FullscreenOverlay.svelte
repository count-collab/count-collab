<script lang="ts">
  import type { Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import { lockBodyScroll } from "$lib/utils/scroll-lock";

  let {
    open = $bindable(),
    title,
    onclose,
    children,
    footer,
    headerActions,
    maxWidth = "max-w-2xl",
    showClose = true,
  }: {
    open: boolean;
    title: string;
    onclose?: () => void;
    children: Snippet;
    footer?: Snippet;
    headerActions?: Snippet;
    maxWidth?: string;
    showClose?: boolean;
  } = $props();

  const uid = $props.id();
  const titleId = `${uid}-title`;

  let dialogEl = $state<HTMLDivElement>();

  function close() {
    open = false;
    onclose?.();
  }

  $effect(() => {
    if (!open) return;
    return lockBodyScroll();
  });

  $effect(() => {
    if (!open || !dialogEl) return;
    const container = dialogEl;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Deferred so children that focus an element on open (autofocus, tick) win
    queueMicrotask(() => {
      if (!container.isConnected || container.contains(document.activeElement))
        return;
      const autofocusEl =
        container.querySelector<HTMLElement>("[autofocus]");
      (autofocusEl ?? container).focus();
    });

    return () => {
      if (previous?.isConnected) previous.focus();
    };
  });
</script>

<svelte:window
  onkeydown={(e) => {
    // Nested dialogs (Modal) prevent default when they consume Escape
    if (open && e.key === "Escape" && !e.defaultPrevented) close();
  }}
/>

{#if open}
  <div
    bind:this={dialogEl}
    class="fixed inset-0 z-50 flex flex-col bg-white focus:outline-none dark:bg-slate-900"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
    transition:fade={{ duration: 150 }}
  >
    <div
      class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700"
    >
      <h2
        id={titleId}
        class="text-xl font-bold text-slate-900 dark:text-slate-100"
      >
        {title}
      </h2>
      {#if headerActions || showClose}
        <div class="flex items-center gap-2">
          {@render headerActions?.()}
          {#if showClose}
            <button
              type="button"
              onclick={close}
              class="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <ion-icon
                name="close-outline"
                class="block"
                style="font-size: 24px;"
                aria-hidden="true"
              ></ion-icon>
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="{maxWidth} mx-auto px-4 py-6 space-y-8">
        {@render children()}
      </div>
    </div>

    {#if footer}
      <div
        class="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="{maxWidth} mx-auto">
          {@render footer()}
        </div>
      </div>
    {/if}
  </div>
{/if}
