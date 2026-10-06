<script lang="ts">
  let {
    message,
    onDismiss,
  }: {
    message: string;
    onDismiss: () => void;
  } = $props();

  let visible = $state(false);

  $effect(() => {
    requestAnimationFrame(() => {
      visible = true;
    });

    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);

    return () => clearTimeout(timer);
  });
</script>

<div
  class="pointer-events-auto w-full max-w-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg dark:shadow-slate-900/50 transition-all duration-300 ease-out {visible
    ? 'translate-x-0 opacity-100'
    : 'translate-x-full opacity-0'}"
  role="status"
>
  <div class="p-4 flex items-start gap-3">
    <div
      class="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
    >
      <ion-icon name="people-outline" style="font-size: 18px;"></ion-icon>
    </div>
    <p class="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300">
      {message}
    </p>
    <button
      type="button"
      onclick={onDismiss}
      class="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
      aria-label="Dismiss notification"
    >
      <ion-icon name="close-outline" style="font-size: 18px;"></ion-icon>
    </button>
  </div>
</div>
