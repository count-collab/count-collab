<script lang="ts">
  type Props = {
    username: string | null;
    newValue: number;
    changedAt: string | Date;
  };

  const { username, newValue, changedAt }: Props = $props();

  const date = $derived(new Date(changedAt));
  const isToday = $derived(date.toDateString() === new Date().toDateString());
  const time = $derived(
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  );
  const dateStr = $derived(
    `${date.getDate()}.${date.getMonth() + 1}.${String(date.getFullYear()).slice(2)}`,
  );
  const displayName = $derived(username ?? "Anonymous");
</script>

<li class="text-xs text-slate-400">
  <span class="font-medium text-slate-500">{displayName}</span>
  &rarr; {newValue}
  <span class="text-slate-300">
    @ {time}{isToday ? "" : ` ${dateStr}`}
  </span>
</li>
