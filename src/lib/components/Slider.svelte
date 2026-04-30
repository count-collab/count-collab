<script lang="ts">
  let {
    value = $bindable(),
    min = 1,
    max = 60,
    step = 1,
    unit,
    disabled = false,
    label,
  }: {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
    label?: string;
  } = $props();

  let progress = $derived(((value - min) / (max - min)) * 100);
</script>

<div class="space-y-1 {disabled ? 'opacity-50' : ''}">
  {#if label}
    <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
    </span>
  {/if}
  <div class="flex items-center gap-3">
    <input
      type="range"
      {min}
      {max}
      {step}
      {disabled}
      bind:value
      aria-label={label ?? "Slider"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      class="slider flex-1 {disabled ? 'cursor-not-allowed' : 'cursor-pointer'}"
      style="--progress: {progress}%"
    />
    <span
      class="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400 shrink-0 w-10 text-right"
    >
      {value}{unit ?? ""}
    </span>
  </div>
</div>

<style>
  .slider {
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      #2563eb var(--progress),
      #e2e8f0 var(--progress)
    );
    outline: none;
  }

  :global(.dark) .slider {
    background: linear-gradient(
      to right,
      #3b82f6 var(--progress),
      #334155 var(--progress)
    );
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    border: 2px solid transparent;
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .slider:not(:disabled)::-webkit-slider-thumb:hover {
    border-color: #2563eb;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
  }

  .slider:focus-visible::-webkit-slider-thumb {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .slider:disabled::-webkit-slider-thumb {
    cursor: not-allowed;
  }

  .slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    border: 2px solid transparent;
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .slider:not(:disabled)::-moz-range-thumb:hover {
    border-color: #2563eb;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
  }

  .slider:focus-visible::-moz-range-thumb {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .slider:disabled::-moz-range-thumb {
    cursor: not-allowed;
  }

  .slider::-moz-range-track {
    background: transparent;
    border: none;
    height: 8px;
  }
</style>
