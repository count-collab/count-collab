<script lang="ts">
  let { text, onDark = false }: { text: string; onDark?: boolean } = $props();
</script>

<p
  class="flex items-center gap-3 font-[ui-monospace,monospace] text-xs font-bold uppercase leading-[1.2] tracking-[0.12em] {onDark
    ? 'text-blue-300'
    : 'text-blue-700 dark:text-blue-300'}"
>
  <span class="h-0.5 w-8 bg-current" aria-hidden="true"></span>
  {text}
</p>
