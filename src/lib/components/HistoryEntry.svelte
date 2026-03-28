<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import type { TransitionConfig } from "svelte/transition";

  type Props = {
    username: string | null;
    newValue: number;
    previousValue: number;
    changedAt: string | Date;
    index: number;
  };

  const { username, newValue, previousValue, changedAt, index }: Props = $props();

  const date = $derived(new Date(changedAt));
  const isToday = $derived(date.toDateString() === new Date().toDateString());
  const time = $derived(
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  );
  const dateStr = $derived(
    `${date.getDate()}.${date.getMonth() + 1}.${String(date.getFullYear()).slice(2)}`,
  );
  const displayName = $derived(username ?? "Someone");
  const delta = $derived(newValue - previousValue);
  const deltaLabel = $derived(delta >= 0 ? `+${delta}` : `${delta}`);

  function slideIn(_node: Element): TransitionConfig {
    return {
      delay: index * 50,
      duration: 300,
      easing: cubicOut,
      css: (t) => `opacity: ${t}; transform: translateX(${(1 - t) * -12}px)`,
    };
  }
</script>

<li class="inline-flex items-center gap-1 text-xs text-slate-400" in:slideIn>
  <span class="font-medium text-slate-500">{displayName}</span>
  <span
    class="inline-flex items-center rounded-full px-1 py-px text-[10px] font-semibold leading-tight {delta >= 0
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700'}"
  >
    {deltaLabel}
  </span>
  <span>&rarr; {newValue}</span>
  <span class="text-slate-300">
    @ {time}{isToday ? "" : ` ${dateStr}`}
  </span>
</li>
