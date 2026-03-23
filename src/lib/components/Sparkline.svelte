<script module lang="ts">


  import type { SparklinePoint } from "$lib/db/schema";

  let sparklineData = $state<Record<string, SparklinePoint[]>>({});
</script>

<script lang="ts">
  import { fade } from "svelte/transition";
  import { browser } from "$app/environment";

  type Props = {
    counterId: string;
  };

  const { counterId }: Props = $props();

  const points = $derived(sparklineData[counterId] ?? []);

  $effect(() => {
    if (!browser) return;
    if (sparklineData[counterId]) return;

    fetch(`/api/counters/${counterId}/sparkline`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SparklinePoint[] | null) => {
        if (data) {
          sparklineData[counterId] = data;
        }
      })
      .catch(() => {});
  });

  const viewW = 200;
  const viewH = 60;
  const padY = 4;

  const polylinePoints = $derived.by(() => {
    if (points.length < 2) return "";

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const innerH = viewH - padY * 2;

    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * viewW;
        const y = padY + innerH - ((p.value - min) / range) * innerH;
        return `${x},${y}`;
      })
      .join(" ");
  });

  const strokeColor = "rgba(99,102,241,0.18)";
  const fillColor = "rgba(99,102,241,0.03)";

  const areaPoints = $derived.by(() => {
    if (points.length < 2) return "";
    return `0,${viewH} ${polylinePoints} ${viewW},${viewH}`;
  });
</script>

{#if points.length >= 2}
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 {viewW} {viewH}"
    preserveAspectRatio="none"
    fill="none"
    class="sparkline"
    aria-hidden="true"
    transition:fade={{ duration: 400 }}
  >
    <polygon points={areaPoints} fill={fillColor} />
    <polyline
      points={polylinePoints}
      stroke={strokeColor}
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </svg>
{/if}
