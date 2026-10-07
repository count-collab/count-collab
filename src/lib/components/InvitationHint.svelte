<script lang="ts">
  import { onDestroy } from "svelte";
  import { fly } from "svelte/transition";
  import { afterNavigate } from "$app/navigation";

  const VISIBLE_MS = 6000;

  const { count }: { count: number } = $props();

  let visible = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  // "enter" is the initial page load; client-side navigations have other types
  afterNavigate(({ type, to }) => {
    if (type !== "enter") {
      visible = false;
      return;
    }
    if (count <= 0 || to?.url.pathname.startsWith("/invitations")) return;

    visible = true;
    timer = setTimeout(() => (visible = false), VISIBLE_MS);
  });

  onDestroy(() => clearTimeout(timer));
</script>

{#if visible}
  <div
    role="status"
    transition:fly={{ y: -6, duration: 200 }}
    class="pointer-events-none absolute top-full right-0 mt-3 z-30 w-max max-w-[16rem]"
  >
    <div
      class="relative rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20"
    >
      <span
        class="absolute -top-1 right-3.5 h-2 w-2 rotate-45 bg-indigo-600"
        aria-hidden="true"
      ></span>
      You have {count} pending {count === 1 ? "invitation" : "invitations"}
    </div>
  </div>
{/if}
