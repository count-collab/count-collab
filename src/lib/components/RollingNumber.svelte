<script lang="ts">
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";

  const { value }: { value: number } = $props();

  interface DigitEntry {
    digit: string;
    visible: boolean;
  }

  const digits = $derived(value.toLocaleString("en-US").split(""));
  let prevLength = -1;
  let prevDigits: string[] = [];
  let displayEntries: DigitEntry[] = $state([]);
  let swapTimeout: ReturnType<typeof setTimeout> | null = null;

  const duration = 350;
  const slideDuration = 150;
  const stagger = 80;

  function slideWidth(_node: Element, { duration: d }: { duration: number }) {
    return {
      duration: d,
      easing: cubicOut,
      css: (t: number) => `max-width: ${t}ch;`,
    };
  }

  $effect.pre(() => {
    const currentLength = digits.length;
    if (prevLength === -1) {
      // First render — show all immediately
      prevLength = currentLength;
      prevDigits = [...digits];
      displayEntries = digits.map((d) => ({ digit: d, visible: true }));
    } else if (currentLength > prevLength) {
      // Digits increased — new slots visible but empty, existing keep old values frozen
      const newCount = currentLength - prevLength;
      displayEntries = digits.map((_d, j) => ({
        digit: j < newCount ? "" : (prevDigits[j - newCount] ?? _d),
        visible: true,
      }));
      prevLength = currentLength;
      if (swapTimeout) clearTimeout(swapTimeout);
      const targetDigits = [...digits];
      swapTimeout = setTimeout(() => {
        // After slideWidth: update all to new digits — triggers digitIn/Out together
        prevDigits = targetDigits;
        displayEntries = targetDigits.map((d) => ({
          digit: d,
          visible: true,
        }));
      }, slideDuration);
    } else {
      if (currentLength < prevLength) prevLength = currentLength;
      prevDigits = [...digits];
      displayEntries = digits.map((d) => ({ digit: d, visible: true }));
      if (swapTimeout) clearTimeout(swapTimeout);
    }
  });

  function digitIn(_node: Element, { index }: { index: number }) {
    const reverseIndex = displayEntries.length - 1 - index;
    return {
      delay: reverseIndex * stagger,
      duration,
      easing: cubicOut,
      css: (t: number) =>
        `transform: translateY(${(1 - t) * -100}%); opacity: ${t}`,
    };
  }

  function digitOut(_node: Element, { index }: { index: number }) {
    const reverseIndex = displayEntries.length - 1 - index;
    return {
      delay: reverseIndex * stagger,
      duration,
      easing: cubicOut,
      css: (t: number) =>
        `transform: translateY(${(1 - t) * 100}%); opacity: ${t}`,
    };
  }
</script>

<span class="rolling-number" aria-label={value.toLocaleString("en-US")}>
  {#each displayEntries as entry, i (displayEntries.length - i)}
    <span
      class={/\d/.test(entry.digit) || entry.digit === "" ? "rolling-digit-slot" : "rolling-separator"}
      in:slideWidth={{ duration: slideDuration }}
      out:slideWidth={{ duration: slideDuration }}
      animate:flip={{ duration, easing: cubicOut }}
    >
      {#if /\d/.test(entry.digit) || entry.digit === ""}
        {#if entry.visible}
          {#key entry.digit}
            <span
              class="rolling-digit"
              aria-hidden="true"
              in:digitIn={{ index: i }}
              out:digitOut={{ index: i }}
            >
              {entry.digit}
            </span>
          {/key}
        {/if}
      {:else}
        <span aria-hidden="true">{entry.digit}</span>
      {/if}
    </span>
  {/each}
</span>

<style>
  .rolling-number {
    display: inline-flex;
    justify-content: center;
    vertical-align: middle;
    font-variant-numeric: tabular-nums;
    gap: 0;
  }

  .rolling-digit-slot {
    display: inline-block;
    position: relative;
    overflow: hidden;
    height: 1em;
    width: 1ch;
    line-height: 1;
  }

  .rolling-digit {
    display: inline-block;
    position: absolute;
    inset: 0;
    text-align: center;
  }

  .rolling-separator {
    display: inline-block;
    width: 0.5ch;
    text-align: center;
    line-height: 1;
  }
</style>
