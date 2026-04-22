<script lang="ts">
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";

  const { value }: { value: number } = $props();

  interface DigitEntry {
    digit: string;
    visible: boolean;
  }

  const isNegative = $derived(value < 0);
  const digits = $derived(Math.abs(value).toLocaleString("en-US").split(""));
  let showMinus = $state(false);
  let prevNegative = false;
  let prevLength = -1;
  let prevDigits: string[] = [];
  let displayEntries: DigitEntry[] = $state([]);
  let swapTimeout: ReturnType<typeof setTimeout> | null = null;
  let signChangeTimeout: ReturnType<typeof setTimeout> | null = null;

  const duration = 350;
  const slideDuration = 150;
  const stagger = 80;
  // Total durations for minus transitions
  const minusInDuration = slideDuration + 150; // slide + fade
  const minusOutDuration = 100 + slideDuration; // fade + slide

  function slideWidth(_node: Element, { duration: d }: { duration: number }) {
    return {
      duration: d,
      easing: cubicOut,
      css: (t: number) => `max-width: ${t}ch;`,
    };
  }

  function minusIn(node: Element) {
    const targetWidth = node.getBoundingClientRect().width;
    const slidePart = slideDuration;
    const fadePart = 150;
    const total = slidePart + fadePart;
    return {
      duration: total,
      css: (t: number) => {
        const progress = t * total;
        const widthT = Math.min(progress / slidePart, 1);
        const fadeT = Math.max((progress - slidePart) / fadePart, 0);
        return `width: ${cubicOut(widthT) * targetWidth}px; opacity: ${fadeT}; overflow: hidden; margin: 0; padding: 0;`;
      },
    };
  }

  function minusOut(node: Element) {
    const targetWidth = node.getBoundingClientRect().width;
    const fadePart = 100;
    const slidePart = slideDuration;
    const total = fadePart + slidePart;
    return {
      duration: total,
      css: (t: number) => {
        const progress = (1 - t) * total;
        const fadeT = Math.max(1 - progress / fadePart, 0);
        const widthT = Math.max(1 - (progress - fadePart) / slidePart, 0);
        return `width: ${cubicOut(Math.max(widthT, 0)) * targetWidth}px; opacity: ${fadeT}; overflow: hidden; margin: 0; padding: 0;`;
      },
    };
  }

  function updateDigits(targetDigits: string[]) {
    const currentLength = targetDigits.length;
    if (currentLength > prevLength) {
      const newCount = currentLength - prevLength;
      displayEntries = targetDigits.map((_d, j) => ({
        digit: j < newCount ? "" : (prevDigits[j - newCount] ?? _d),
        visible: true,
      }));
      prevLength = currentLength;
      if (swapTimeout) clearTimeout(swapTimeout);
      const frozen = [...targetDigits];
      swapTimeout = setTimeout(() => {
        prevDigits = frozen;
        displayEntries = frozen.map((d) => ({ digit: d, visible: true }));
      }, slideDuration);
    } else {
      if (currentLength < prevLength) prevLength = currentLength;
      prevDigits = [...targetDigits];
      displayEntries = targetDigits.map((d) => ({ digit: d, visible: true }));
      if (swapTimeout) clearTimeout(swapTimeout);
    }
  }

  $effect.pre(() => {
    const currentDigits = [...digits];
    const currentNegative = isNegative;

    if (prevLength === -1) {
      // First render
      prevLength = currentDigits.length;
      prevDigits = currentDigits;
      displayEntries = currentDigits.map((d) => ({ digit: d, visible: true }));
      showMinus = currentNegative;
      prevNegative = currentNegative;
      return;
    }

    const signChanged = currentNegative !== prevNegative;
    prevNegative = currentNegative;

    if (signChangeTimeout) clearTimeout(signChangeTimeout);

    if (signChanged) {
      // Update minus visibility immediately (starts minus animation)
      showMinus = currentNegative;
      // Delay digit roll until minus animation completes
      const delay = currentNegative ? minusInDuration : minusOutDuration;
      signChangeTimeout = setTimeout(() => {
        updateDigits(currentDigits);
      }, delay);
    } else {
      updateDigits(currentDigits);
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

<span class="rolling-wrapper" aria-label={value.toLocaleString("en-US")}>
  {#if showMinus}<span
      class="rolling-minus"
      aria-hidden="true"
      in:minusIn
      out:minusOut>-</span
    >{/if}<span class="rolling-number">
    {#each displayEntries as entry, i (displayEntries.length - i)}
      <span
        class={/\d/.test(entry.digit) || entry.digit === ""
          ? "rolling-digit-slot"
          : "rolling-separator"}
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
</span>

<style>
  .rolling-wrapper {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }

  .rolling-minus {
    display: inline-block;
    line-height: 1;
  }

  .rolling-number {
    display: inline-flex;
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
