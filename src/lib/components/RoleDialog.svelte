<script lang="ts">
  import { tick, untrack } from "svelte";
  import Modal from "$lib/components/Modal.svelte";

  type RoleOption = { value: string; label: string; description: string };

  let {
    open = $bindable(),
    title,
    currentRole,
    roles,
    onselect,
    error = null,
  }: {
    open: boolean;
    title: string;
    currentRole: string;
    roles: RoleOption[];
    // Returning false keeps the dialog open (e.g. after a failed request)
    onselect: (role: string) => boolean | undefined | Promise<boolean | undefined>;
    error?: string | null;
  } = $props();

  let selected = $state("");
  let saving = $state(false);
  let groupEl: HTMLDivElement | undefined = $state();

  const unchanged = $derived(selected === currentRole);

  $effect(() => {
    if (!open) return;
    selected = untrack(() => currentRole);
    saving = false;
    const trigger = document.activeElement as HTMLElement | null;
    tick().then(() =>
      groupEl?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus(),
    );
    return () => trigger?.focus?.();
  });

  function handleKeydown(event: KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = roles[(index + step + roles.length) % roles.length];
    selected = next.value;
    tick().then(() =>
      groupEl?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus(),
    );
  }

  async function save() {
    if (saving || unchanged) return;
    saving = true;
    try {
      const result = await onselect(selected);
      if (result !== false) open = false;
    } finally {
      saving = false;
    }
  }
</script>

<Modal bind:open {title}>
  <div
    bind:this={groupEl}
    role="radiogroup"
    aria-label="Role"
    class="space-y-2"
  >
    {#each roles as role, i (role.value)}
      {@const isSelected = selected === role.value}
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        tabindex={isSelected ? 0 : -1}
        onclick={() => (selected = role.value)}
        onkeydown={(e) => handleKeydown(e, i)}
        class="w-full rounded-xl border-2 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 {isSelected
          ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
      >
        <span
          class="block text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          {role.label}
        </span>
        <span class="block text-sm text-slate-600 dark:text-slate-400">
          {role.description}
        </span>
      </button>
    {/each}
  </div>

  <div aria-live="polite">
    {#if error}
      <p role="alert" class="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    {/if}
  </div>

  <div class="flex items-center justify-end gap-3">
    <button
      type="button"
      onclick={() => (open = false)}
      class="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
    >
      Cancel
    </button>
    <button
      type="button"
      onclick={save}
      disabled={saving || unchanged}
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {saving ? "Saving…" : "Save"}
    </button>
  </div>
</Modal>
