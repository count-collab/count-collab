<script lang="ts">
  let {
    checked = $bindable(),
    label,
    disabled = false,
  }: {
    checked: boolean;
    label?: string;
    disabled?: boolean;
  } = $props();

  function toggle() {
    if (!disabled) {
      checked = !checked;
    }
  }
</script>

<div
  class="flex items-center justify-between gap-3 {disabled ? 'opacity-50' : ''}"
>
  {#if label}
    <button
      type="button"
      class="text-sm font-medium text-slate-700 dark:text-slate-300 text-left {disabled
        ? 'cursor-not-allowed'
        : 'cursor-pointer'}"
      onclick={toggle}
      {disabled}
      tabindex={-1}
    >
      {label}
    </button>
  {/if}
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label ?? "Toggle"}
    {disabled}
    onclick={toggle}
    class="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 {disabled
      ? 'cursor-not-allowed'
      : 'cursor-pointer'} {checked
      ? 'bg-blue-600 dark:bg-blue-500'
      : 'bg-slate-300 dark:bg-slate-600'}"
  >
    <span
      class="pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 {checked
        ? 'translate-x-[22px]'
        : 'translate-x-0.5'}"
    ></span>
  </button>
</div>
