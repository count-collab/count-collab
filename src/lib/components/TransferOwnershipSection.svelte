<script lang="ts">
  import { tick } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import Modal from "$lib/components/Modal.svelte";

  type TeamRef = { id: string; name: string };
  type DashboardCounter = {
    id: string;
    title: string | null;
    teamId: string | null;
    owned: boolean;
  };

  let {
    type,
    entityId,
    team,
    transferTargets,
    dashboardCounters = [],
    ontransferred,
  }: {
    type: "counter" | "dashboard";
    entityId: string;
    team: TeamRef | null;
    transferTargets: TeamRef[];
    dashboardCounters?: DashboardCounter[];
    ontransferred?: () => void;
  } = $props();

  const PERSONAL = "personal";

  const options = $derived([
    ...(team ? [{ value: PERSONAL, label: "Personal (me)" }] : []),
    ...transferTargets.map((t) => ({ value: t.id, label: t.name })),
  ]);

  let selected = $state("");
  const target = $derived(
    options.some((o) => o.value === selected)
      ? selected
      : (options[0]?.value ?? ""),
  );
  const targetTeam = $derived(
    transferTargets.find((t) => t.id === target) ?? null,
  );

  const ownedCounters = $derived(dashboardCounters.filter((c) => c.owned));
  const otherCounters = $derived(dashboardCounters.filter((c) => !c.owned));

  let checkedCounterIds = $state<string[]>([]);
  let confirmOpen = $state(false);
  let isTransferring = $state(false);
  let transferError = $state("");
  let transferButtonEl: HTMLButtonElement | undefined = $state();
  let confirmButtonEl: HTMLButtonElement | undefined = $state();

  const entityLabel = $derived(type === "counter" ? "counter" : "dashboard");
  const selectId = $derived(`transfer-owner-${entityId}`);

  async function openConfirm() {
    checkedCounterIds = ownedCounters.map((c) => c.id);
    transferError = "";
    confirmOpen = true;
    await tick();
    confirmButtonEl?.focus();
  }

  function closeConfirm() {
    confirmOpen = false;
    transferButtonEl?.focus();
  }

  async function handleTransfer() {
    if (isTransferring || !target) return;
    isTransferring = true;
    transferError = "";

    const teamId = target === PERSONAL ? null : target;
    const body =
      type === "dashboard"
        ? { teamId, counterIds: teamId ? checkedCounterIds : [] }
        : { teamId };

    try {
      const res = await fetch(`/api/${type}s/${entityId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        transferError =
          data.message ?? data.error ?? `Failed to transfer ${entityLabel}.`;
        return;
      }

      confirmOpen = false;
      await invalidateAll();
      ontransferred?.();
    } catch {
      transferError = "Network error. Please try again.";
    } finally {
      isTransferring = false;
    }
  }
</script>

<section class="space-y-4">
  <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
    Ownership
  </h3>
  <p class="text-sm text-slate-500 dark:text-slate-400">
    {#if team}
      This {entityLabel} is owned by the team <span
        class="font-medium text-slate-700 dark:text-slate-300">{team.name}</span
      >.
    {:else}
      This {entityLabel} is owned by you.
    {/if}
  </p>
  {#if options.length > 0}
    <div class="flex flex-wrap items-end gap-2">
      <div class="flex-1 min-w-48">
        <label
          for={selectId}
          class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
          >Move to</label
        >
        <select
          id={selectId}
          value={target}
          onchange={(e) => (selected = e.currentTarget.value)}
          class="w-full h-9 rounded-md border border-slate-300 px-3 text-sm bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400"
        >
          {#each options as opt (opt.value)}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <button
        type="button"
        bind:this={transferButtonEl}
        onclick={openConfirm}
        class="h-9 px-4 text-sm border border-slate-300 rounded-md hover:bg-slate-50 transition inline-flex items-center gap-1.5 dark:border-slate-600 dark:hover:bg-slate-700"
      >
        <ion-icon name="swap-horizontal-outline" aria-hidden="true"></ion-icon>
        Transfer
      </button>
    </div>
  {:else}
    <p class="text-sm text-slate-500 dark:text-slate-400">
      You need to be an editor in a team to move this {entityLabel} there.
      <a
        href="/my/teams"
        class="text-blue-600 dark:text-blue-400 hover:underline">Manage teams</a
      >
    </p>
  {/if}
</section>

<Modal
  bind:open={confirmOpen}
  title="Transfer {entityLabel}?"
  describedBy="transfer-{entityId}-description"
  onclose={() => transferButtonEl?.focus()}
>
  <div id="transfer-{entityId}-description" class="space-y-3 text-sm">
    {#if targetTeam}
      <p class="text-slate-600 dark:text-slate-400">
        This {entityLabel} will be owned by
        <span class="font-medium text-slate-900 dark:text-slate-100"
          >{targetTeam.name}</span
        >. All members of {targetTeam.name} get access according to their team
        role. You will keep access only through your role in {targetTeam.name}.
      </p>
    {:else}
      <p class="text-slate-600 dark:text-slate-400">
        You will become the owner of this {entityLabel}.
      </p>
    {/if}
    {#if team}
      <p class="text-slate-600 dark:text-slate-400">
        Members of {team.name} will no longer have access through that team.
      </p>
    {/if}
  </div>

  {#if targetTeam && dashboardCounters.length > 0}
    <div class="space-y-3 text-sm">
      {#if ownedCounters.length > 0}
        <fieldset class="space-y-2">
          <legend class="font-medium text-slate-900 dark:text-slate-100">
            Also move these counters you own
          </legend>
          {#each ownedCounters as counter (counter.id)}
            <label
              class="flex items-center gap-2 text-slate-700 dark:text-slate-300"
            >
              <input
                type="checkbox"
                value={counter.id}
                bind:group={checkedCounterIds}
                class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
              />
              {counter.title}
            </label>
          {/each}
        </fieldset>
      {/if}
      {#if otherCounters.length > 0}
        <div class="space-y-1">
          <p class="font-medium text-slate-900 dark:text-slate-100">
            Other counters on this dashboard
          </p>
          <ul class="space-y-1">
            {#each otherCounters as counter (counter.id)}
              <li class="text-slate-700 dark:text-slate-300">
                {counter.title ?? "Private counter"}
                <span class="block text-xs text-slate-500 dark:text-slate-400">
                  {#if counter.teamId === targetTeam.id}
                    Already owned by {targetTeam.name}
                  {:else}
                    Not owned by you — team members will only see them if they
                    already have access
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}

  <div aria-live="polite">
    {#if transferError}
      <p class="text-sm text-red-600 dark:text-red-400">{transferError}</p>
    {/if}
  </div>

  <div class="flex items-center justify-end gap-3">
    <button
      type="button"
      onclick={closeConfirm}
      class="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
    >
      Cancel
    </button>
    <button
      type="button"
      bind:this={confirmButtonEl}
      onclick={handleTransfer}
      disabled={isTransferring}
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isTransferring ? "Transferring…" : "Transfer"}
    </button>
  </div>
</Modal>
