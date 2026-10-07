<script lang="ts">
  
  import posthog from "posthog-js";
import { untrack } from "svelte";
  import { fly } from "svelte/transition";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { slugify } from "$lib/counter";
  import type {
    CounterMode,
    CounterVisibilityMode,
    DashboardVisibilityMode,
    TeamMemberRole,
  } from "$lib/db/schema";
  import { canAssignTeamRole, teamRoleLabels, teamRoleOrder } from "$lib/roles";
  import { rateLimit } from "$lib/stores/ratelimit";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  type CreationType = "counter" | "dashboard" | "team";
  type StepId =
    | "type"
    | "owner"
    | "visibility"
    | "mode"
    | "details"
    | "team-details"
    | "team-invite";

  const isLoggedIn = $derived(!!data.session?.user);

  const initialType = untrack(() => data.preselectedType);
  const skippedStep1 = !!initialType;
  const initialTeamId = untrack(() => {
    const requested = $page.url.searchParams.get("teamId") ?? "";
    return data.teams.some((t) => t.id === requested) ? requested : "";
  });

  let creationType = $state<CreationType | null>(initialType);
  let counterMode = $state<CounterMode>("increment_only");
  let visibility = $state<
    CounterVisibilityMode | DashboardVisibilityMode | null
  >(initialTeamId ? "private" : null);
  let visibilityChosen = false;
  let title = $state("");
  let description = $state("");
  let ownerKind = $state<"me" | "team">(initialTeamId ? "team" : "me");
  let ownerTeamId = $state(initialTeamId);
  let errors = $state<Record<string, string>>({});
  let isSubmitting = $state(false);
  const canGoBack = browser && window.history.length > 1;

  // Step management
  // A team passed via ?teamId (e.g. from the team page) already decides the owner
  const showOwnerStep = $derived(
    isLoggedIn && data.teams.length > 0 && !initialTeamId,
  );
  const steps = $derived.by<StepId[]>(() => {
    const first: StepId[] = skippedStep1 ? [] : ["type"];
    if (creationType === "team") {
      return [...first, "team-details", "team-invite"];
    }
    return [
      ...first,
      ...(showOwnerStep ? ["owner" as const] : []),
      "visibility",
      ...(creationType === "counter" ? ["mode" as const] : []),
      "details",
    ];
  });
  const totalSteps = $derived(steps.length);

  let currentStep = $state<StepId>(untrack(() => steps[0]));
  let direction = $state<"forward" | "backward">("forward");

  const flyX = $derived(direction === "forward" ? 300 : -300);

  const typeLabel = $derived(
    creationType === "dashboard" ? "dashboard" : "counter",
  );

  const displayStep = $derived(steps.indexOf(currentStep) + 1);
  // The team already exists once the invite step is reached
  const canStepBack = $derived(
    displayStep > 1 && currentStep !== "team-invite",
  );

  function enterStep(step: StepId, dir: "forward" | "backward" = "forward") {
    if (step === "visibility" && !visibilityChosen) {
      visibility = ownerKind === "team" ? "private" : null;
    }
    direction = dir;
    currentStep = step;
  }

  function advance(delay = 300) {
    const from = currentStep;
    direction = "forward";
    setTimeout(() => {
      if (currentStep !== from) return;
      const next = steps[steps.indexOf(from) + 1];
      if (next) enterStep(next);
    }, delay);
  }

  function selectType(type: CreationType) {
    creationType = type;
    advance();
  }

  function selectOwnerMe() {
    ownerKind = "me";
    ownerTeamId = "";
    advance();
  }

  function selectOwnerTeam(teamId: string) {
    ownerTeamId = teamId;
    advance();
  }

  function selectVisibility(
    v: CounterVisibilityMode | DashboardVisibilityMode,
  ) {
    visibility = v;
    visibilityChosen = true;
    advance();
  }

  function selectCounterMode(mode: CounterMode) {
    counterMode = mode;
    advance();
  }

  function goBack() {
    if (!canStepBack) return;
    enterStep(steps[displayStep - 2], "backward");
  }

  // ── Team branch ──
  let teamName = $state("");
  let teamDescription = $state("");
  let teamErrors = $state<{
    name?: string;
    description?: string;
    general?: string;
  }>({});
  let isCreatingTeam = $state(false);
  let createdTeam = $state<{ id: string; name: string } | null>(null);

  async function handleCreateTeam(event: SubmitEvent) {
    event.preventDefault();
    if (isCreatingTeam) return;

    const trimmedName = teamName.trim();
    if (!trimmedName) {
      teamErrors = { name: "Name is required" };
      return;
    }

    isCreatingTeam = true;
    teamErrors = {};

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: teamDescription.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          teamErrors = {
            general: `You're creating teams too quickly. Please wait ${body.retryAfterSeconds ?? 60}s and try again.`,
          };
          return;
        }
        const nameError = body.errors?.name?.[0];
        const descriptionError = body.errors?.description?.[0];
        teamErrors =
          nameError || descriptionError
            ? { name: nameError, description: descriptionError }
            : {
                general: body.error ?? body.message ?? "Failed to create team.",
              };
        return;
      }

      createdTeam = { id: body.id, name: body.name };
      enterStep("team-invite");
    } catch {
      teamErrors = { general: "Network error. Please try again." };
    } finally {
      isCreatingTeam = false;
    }
  }

  // The creator is the team owner
  const inviteRoleOptions = teamRoleOrder.filter((r) =>
    canAssignTeamRole("owner", null, r),
  );
  let inviteUsername = $state("");
  let inviteRole = $state<TeamMemberRole>("viewer");
  let inviteError = $state<string | null>(null);
  let isInviting = $state(false);
  let invited = $state<{ username: string; role: TeamMemberRole }[]>([]);

  async function handleInvite(event: SubmitEvent) {
    event.preventDefault();
    const username = inviteUsername.trim();
    if (!createdTeam || !username || isInviting) return;

    isInviting = true;
    inviteError = null;
    const role = inviteRole;

    try {
      const response = await fetch(`/t/${createdTeam.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const fieldError = Object.values(
          (body.errors ?? {}) as Record<string, string[] | undefined>,
        ).flat()[0];
        inviteError =
          body.error ??
          body.message ??
          fieldError ??
          "Failed to send invitation.";
        return;
      }

      invited = [
        ...invited.filter((i) => i.username !== username),
        { username, role },
      ];
      inviteUsername = "";
    } catch {
      inviteError = "Network error. Please try again.";
    } finally {
      isInviting = false;
    }
  }

  async function finishTeam() {
    if (!createdTeam) return;
    await goto(`/t/${createdTeam.id}/${slugify(createdTeam.name)}`);
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    isSubmitting = true;
    errors = {};

    const apiPath =
      creationType === "dashboard" ? "/api/dashboards" : "/api/counters";

    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          visibility,
          counterMode: creationType === "counter" ? counterMode : undefined,
          teamId: ownerKind === "team" ? ownerTeamId : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json();

        if (response.status === 429) {
          const retryAfter = body.retryAfterSeconds ?? 60;
          rateLimit.setLimit(apiPath, retryAfter);
          errors = {
            general: `You've created a lot of counters in a short time. Please wait ${retryAfter} seconds before trying again.`,
          };
          return;
        }

        errors = body.errors ?? {
          general: body.message ?? `Failed to create ${typeLabel}.`,
        };
        return;
      }

      const result: { id: string } = await response.json();
      const prefix = creationType === "dashboard" ? "/d" : "/c";
      const eventName = creationType === "dashboard" ? "dashboard_created" : "counter_created";
      posthog.capture(eventName, {
        title,
        visibility,
        ...(creationType === "counter" ? { counter_mode: counterMode } : {}),
      });
      await goto(`${prefix}/${result.id}`);
    } catch {
      errors = { general: "Network error. Please try again." };
    } finally {
      isSubmitting = false;
    }
  }
</script>

<MetaTags
  title="Create | Count Collab"
  description="Create a new counter, dashboard or team and share it in real-time."
  path="/create"
/>

{#snippet spinner()}
  <svg
    class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      class="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="4"
    ></circle>
    <path
      class="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
{/snippet}

<div class="w-full max-w-2xl mx-auto px-4 flex flex-col justify-center flex-1">
  <!-- Top bar: back button + step dots -->
  <div class="flex items-center pt-2 mb-8">
    <button
      type="button"
      onclick={goBack}
      class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 flex items-center gap-1 {canStepBack
        ? ''
        : 'invisible'}"
    >
      &larr; Back
    </button>
    <div class="flex justify-center gap-2 flex-1">
      {#each Array(totalSteps) as _, i}
        <span
          class="inline-block h-2.5 w-2.5 rounded-full {displayStep === i + 1
            ? 'bg-blue-600 dark:bg-blue-400'
            : i + 1 < displayStep
              ? 'bg-blue-600/40 dark:bg-blue-400/40'
              : 'border-2 border-slate-300 dark:border-slate-600'}"
        ></span>
      {/each}
    </div>
    <div class="w-12"></div>
  </div>

  <!-- Wizard steps -->
  <div
    class="grid overflow-hidden w-full p-1 -m-1 min-h-[24rem]"
    style="grid-template: 1fr / 1fr;"
  >
    {#key currentStep}
      <div
        in:fly={{ x: flyX, duration: 300 }}
        out:fly={{ x: -flyX, duration: 300 }}
        style="grid-area: 1 / 1;"
        class="w-full"
      >
        {#if currentStep === "type"}
          <!-- Step 1: Choose type -->
          <div class="space-y-6">
            <header class="space-y-2 text-center">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                What do you want to create?
              </h1>
            </header>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onclick={() => selectType("counter")}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-8 transition-all cursor-pointer
                {creationType === 'counter'
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <ion-icon
                  name="add-circle-outline"
                  class="text-4xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-lg font-semibold text-slate-900 dark:text-slate-100"
                  >Counter</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                  >Track a single value collaboratively</span
                >
              </button>

              <button
                type="button"
                disabled={!isLoggedIn}
                onclick={() => selectType("dashboard")}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-8 transition-all
                {!isLoggedIn
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 opacity-60 cursor-not-allowed'
                  : creationType === 'dashboard'
                    ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'}"
              >
                <ion-icon
                  name="grid-outline"
                  class="text-4xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-lg font-semibold text-slate-900 dark:text-slate-100"
                  >Dashboard</span
                >
                {#if !isLoggedIn}
                  <span
                    class="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-700/80 rounded-full px-3 py-1"
                  >
                    <ion-icon name="lock-closed-outline" class="text-sm"
                    ></ion-icon>
                    Sign in to unlock
                  </span>
                {:else}
                  <span
                    class="text-sm text-slate-600 dark:text-slate-400 text-center"
                    >Group multiple counters in one view</span
                  >
                {/if}
              </button>

              <button
                type="button"
                disabled={!isLoggedIn}
                onclick={() => selectType("team")}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-8 transition-all
                {!isLoggedIn
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 opacity-60 cursor-not-allowed'
                  : creationType === 'team'
                    ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'}"
              >
                <ion-icon
                  name="people-outline"
                  class="text-4xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-lg font-semibold text-slate-900 dark:text-slate-100"
                  >Team</span
                >
                {#if !isLoggedIn}
                  <span
                    class="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-700/80 rounded-full px-3 py-1"
                  >
                    <ion-icon name="lock-closed-outline" class="text-sm"
                    ></ion-icon>
                    Sign in to unlock
                  </span>
                {:else}
                  <span
                    class="text-sm text-slate-600 dark:text-slate-400 text-center"
                    >Share counters & dashboards with a group</span
                  >
                {/if}
              </button>
            </div>

            {#if canGoBack}
              <div class="text-center">
                <button
                  type="button"
                  onclick={() => history.back()}
                  class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Cancel
                </button>
              </div>
            {/if}
          </div>
        {:else if currentStep === "owner"}
          <!-- Choose owner (only when the user can create for a team) -->
          <div class="space-y-6">
            <header class="space-y-2 text-center">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Who should own your {typeLabel}?
              </h1>
            </header>

            <div class="grid grid-cols-2 gap-4">
              <button
                type="button"
                onclick={selectOwnerMe}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all cursor-pointer
                {ownerKind === 'me'
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <ion-icon
                  name="person-outline"
                  class="text-3xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >Me</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                  >Owned and managed by you</span
                >
              </button>

              <button
                type="button"
                onclick={() => (ownerKind = "team")}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all cursor-pointer
                {ownerKind === 'team'
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <ion-icon
                  name="people-outline"
                  class="text-3xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >Team</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                  >Shared with a team's members</span
                >
              </button>
            </div>

            {#if ownerKind === "team"}
              <div
                role="group"
                aria-labelledby="create-owner-team-label"
                class="space-y-2"
              >
                <p
                  id="create-owner-team-label"
                  class="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Choose a team
                </p>
                {#each data.teams as team (team.id)}
                  <button
                    type="button"
                    onclick={() => selectOwnerTeam(team.id)}
                    class="flex w-full flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all cursor-pointer
                    {ownerTeamId === team.id
                      ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
                  >
                    <span
                      class="max-w-full font-semibold text-slate-900 dark:text-slate-100 truncate"
                    >
                      {team.name}
                    </span>
                    <span
                      class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400"
                    >
                      <span class="inline-flex items-center gap-1">
                        <ion-icon name="people-outline" style="font-size: 14px;"
                        ></ion-icon>
                        {team.memberCount}
                        {team.memberCount === 1 ? "member" : "members"}
                      </span>
                      <span class="inline-flex items-center gap-1">
                        <ion-icon name="pulse-outline" style="font-size: 14px;"
                        ></ion-icon>
                        {team.counterCount}
                        {team.counterCount === 1 ? "counter" : "counters"}
                      </span>
                      <span class="inline-flex items-center gap-1">
                        <ion-icon name="apps-outline" style="font-size: 14px;"
                        ></ion-icon>
                        {team.dashboardCount}
                        {team.dashboardCount === 1 ? "dashboard" : "dashboards"}
                      </span>
                    </span>
                  </button>
                {/each}
              </div>
            {/if}

            {#if canGoBack}
              <div class="text-center">
                <button
                  type="button"
                  onclick={() => history.back()}
                  class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Cancel
                </button>
              </div>
            {/if}
          </div>
        {:else if currentStep === "visibility"}
          <!-- Choose visibility -->
          <div class="space-y-6">
            <header class="space-y-2 text-center">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                How should your {typeLabel} be accessible?
              </h1>
            </header>

            <div
              class="grid grid-cols-1 gap-4"
              class:sm:grid-cols-3={creationType === "counter"}
              class:sm:grid-cols-2={creationType !== "counter"}
            >
              <!-- Public -->
              <button
                type="button"
                onclick={() => selectVisibility("public")}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all cursor-pointer
                {visibility === 'public'
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <ion-icon
                  name="globe-outline"
                  class="text-3xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >Public</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                >
                  {#if creationType === "counter"}
                    Anyone can view and increment
                  {:else}
                    Anyone can view
                  {/if}
                </span>
              </button>

              {#if creationType === "counter"}
                <!-- Read-only (counter only) -->
                <button
                  type="button"
                  disabled={!isLoggedIn}
                  onclick={() => selectVisibility("public_readonly")}
                  class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all
                  {!isLoggedIn
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 opacity-60 cursor-not-allowed'
                    : visibility === 'public_readonly'
                      ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'}"
                >
                  <ion-icon
                    name="eye-outline"
                    class="text-3xl text-blue-600 dark:text-blue-400"
                  ></ion-icon>
                  <span
                    class="text-base font-semibold text-slate-900 dark:text-slate-100"
                    >Read-only</span
                  >
                  {#if !isLoggedIn}
                    <span
                      class="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-700/80 rounded-full px-3 py-1"
                    >
                      <ion-icon name="lock-closed-outline" class="text-sm"
                      ></ion-icon>
                      Sign in to unlock
                    </span>
                  {:else}
                    <span
                      class="text-sm text-slate-600 dark:text-slate-400 text-center"
                      >Anyone can view, only members can increment</span
                    >
                  {/if}
                </button>
              {/if}

              <!-- Private -->
              <button
                type="button"
                disabled={!isLoggedIn}
                onclick={() => selectVisibility("private")}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all
                {!isLoggedIn
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 opacity-60 cursor-not-allowed'
                  : visibility === 'private'
                    ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'}"
              >
                <ion-icon
                  name="lock-closed-outline"
                  class="text-3xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >Private</span
                >
                {#if !isLoggedIn}
                  <span
                    class="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-700/80 rounded-full px-3 py-1"
                  >
                    <ion-icon name="lock-closed-outline" class="text-sm"
                    ></ion-icon>
                    Sign in to unlock
                  </span>
                {:else}
                  <span
                    class="text-sm text-slate-600 dark:text-slate-400 text-center"
                    >Only invited members can access</span
                  >
                {/if}
              </button>
            </div>

            {#if canGoBack}
              <div class="text-center">
                <button
                  type="button"
                  onclick={() => history.back()}
                  class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Cancel
                </button>
              </div>
            {/if}
          </div>
        {:else if currentStep === "mode"}
          <!-- Counter Mode (counter only) -->
          <div class="space-y-6">
            <header class="space-y-2 text-center">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                How should your counter change?
              </h1>
            </header>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <!-- Increment only -->
              <button
                type="button"
                onclick={() => selectCounterMode("increment_only")}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all cursor-pointer
                {counterMode === 'increment_only'
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <ion-icon
                  name="add-circle-outline"
                  class="text-3xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >Increment only</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                  >Count up — perfect for tracking totals</span
                >
              </button>

              <!-- Decrement only -->
              <button
                type="button"
                onclick={() => selectCounterMode("decrement_only")}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all cursor-pointer
                {counterMode === 'decrement_only'
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <ion-icon
                  name="remove-circle-outline"
                  class="text-3xl text-blue-600 dark:text-blue-400"
                ></ion-icon>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >Decrement only</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                  >Count down — great for countdowns</span
                >
              </button>

              <!-- Both -->
              <button
                type="button"
                onclick={() => selectCounterMode("both")}
                class="flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all cursor-pointer
                {counterMode === 'both'
                  ? 'ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <span
                  class="flex items-center gap-1 text-3xl text-blue-600 dark:text-blue-400"
                >
                  <ion-icon name="add-circle-outline"></ion-icon>
                  <ion-icon name="remove-circle-outline"></ion-icon>
                </span>
                <span
                  class="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >Both</span
                >
                <span
                  class="text-sm text-slate-600 dark:text-slate-400 text-center"
                  >Count up and down freely</span
                >
              </button>
            </div>

            {#if canGoBack}
              <div class="text-center">
                <button
                  type="button"
                  onclick={() => history.back()}
                  class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Cancel
                </button>
              </div>
            {/if}
          </div>
        {:else if currentStep === "details"}
          <!-- Name & submit -->
          <div class="space-y-6">
            <header class="space-y-1 text-center">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Name your {typeLabel}
              </h1>
              <p class="text-slate-600 dark:text-slate-400">
                You can always change this later.
              </p>
            </header>

            {#if errors.general || errors.teamId}
              <div
                class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400"
              >
                {errors.general ?? errors.teamId}
              </div>
            {/if}

            <form onsubmit={handleSubmit} class="space-y-6">
              <div class="space-y-1">
                <input
                  type="text"
                  required
                  bind:value={title}
                  placeholder="Give it a name..."
                  class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-2xl font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0"
                />
                {#if errors.title}
                  <p class="text-sm text-red-600 dark:text-red-400">
                    {errors.title}
                  </p>
                {/if}
              </div>

              <div class="space-y-1">
                <input
                  type="text"
                  bind:value={description}
                  maxlength={500}
                  placeholder="Add a description (optional)"
                  class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-1 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0"
                />
                {#if errors.description}
                  <p class="text-sm text-red-600 dark:text-red-400">
                    {errors.description}
                  </p>
                {/if}
              </div>

              <div class="flex items-center justify-end gap-4">
                {#if canGoBack}
                  <button
                    type="button"
                    onclick={() => history.back()}
                    class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    Cancel
                  </button>
                {/if}

                <button
                  type="submit"
                  disabled={isSubmitting || $rateLimit.isLimited}
                  class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {#if isSubmitting}
                    {@render spinner()}
                    Creating…
                  {:else if $rateLimit.isLimited}
                    Try again in {$rateLimit.retryAfterSeconds}s
                  {:else}
                    Create {typeLabel}
                  {/if}
                </button>
              </div>
            </form>
          </div>
        {:else if currentStep === "team-details"}
          <!-- Team: name & create -->
          <div class="space-y-6">
            <header class="space-y-1 text-center">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Name your team
              </h1>
              <p class="text-slate-600 dark:text-slate-400">
                You can always change this later.
              </p>
            </header>

            <div aria-live="polite">
              {#if teamErrors.general}
                <p
                  role="alert"
                  class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400"
                >
                  {teamErrors.general}
                </p>
              {/if}
            </div>

            <form onsubmit={handleCreateTeam} class="space-y-6" novalidate>
              <div class="space-y-1">
                <label for="create-team-name" class="sr-only">Team name</label>
                <input
                  id="create-team-name"
                  type="text"
                  required
                  maxlength={50}
                  autocomplete="off"
                  bind:value={teamName}
                  placeholder="Give it a name..."
                  aria-invalid={teamErrors.name ? "true" : undefined}
                  aria-describedby={teamErrors.name
                    ? "create-team-name-error"
                    : undefined}
                  class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-2xl font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0"
                />
                {#if teamErrors.name}
                  <p
                    id="create-team-name-error"
                    role="alert"
                    class="text-sm text-red-600 dark:text-red-400"
                  >
                    {teamErrors.name}
                  </p>
                {/if}
              </div>

              <div class="space-y-1">
                <label for="create-team-description" class="sr-only"
                  >Team description</label
                >
                <input
                  id="create-team-description"
                  type="text"
                  maxlength={500}
                  bind:value={teamDescription}
                  placeholder="Add a description (optional)"
                  aria-invalid={teamErrors.description ? "true" : undefined}
                  aria-describedby={teamErrors.description
                    ? "create-team-description-error"
                    : undefined}
                  class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-0 py-1 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0"
                />
                {#if teamErrors.description}
                  <p
                    id="create-team-description-error"
                    role="alert"
                    class="text-sm text-red-600 dark:text-red-400"
                  >
                    {teamErrors.description}
                  </p>
                {/if}
              </div>

              <div class="flex items-center justify-end gap-4">
                {#if canGoBack}
                  <button
                    type="button"
                    onclick={() => history.back()}
                    class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    Cancel
                  </button>
                {/if}

                <button
                  type="submit"
                  disabled={isCreatingTeam}
                  class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {#if isCreatingTeam}
                    {@render spinner()}
                    Creating…
                  {:else}
                    Create team
                  {/if}
                </button>
              </div>
            </form>
          </div>
        {:else if currentStep === "team-invite" && createdTeam}
          <!-- Team: invite members (team already exists, no way back) -->
          <div class="space-y-6">
            <header class="space-y-1 text-center">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Invite members
              </h1>
              <p class="text-slate-600 dark:text-slate-400">
                Optional. You can also invite people later from the team page.
              </p>
            </header>

            <form onsubmit={handleInvite} class="flex gap-2 items-end">
              <div class="flex-1">
                <label
                  class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  for="create-invite-username">Username</label
                >
                <input
                  id="create-invite-username"
                  type="text"
                  bind:value={inviteUsername}
                  placeholder="username"
                  autocomplete="off"
                  class="w-full h-9 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
                />
              </div>
              <div>
                <label
                  class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  for="create-invite-role">Role</label
                >
                <select
                  id="create-invite-role"
                  bind:value={inviteRole}
                  class="h-9 rounded-md border border-slate-300 px-3 text-sm bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400"
                >
                  {#each inviteRoleOptions as r (r)}
                    <option value={r}>{teamRoleLabels[r]}</option>
                  {/each}
                </select>
              </div>
              <button
                type="submit"
                disabled={isInviting || !inviteUsername.trim()}
                class="h-9 px-4 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              >
                Invite
              </button>
            </form>

            <div aria-live="polite" class="space-y-3">
              {#if inviteError}
                <p role="alert" class="text-sm text-red-600 dark:text-red-400">
                  {inviteError}
                </p>
              {/if}
              {#if invited.length > 0}
                <ul class="flex flex-wrap gap-2" aria-label="Invited members">
                  {#each invited as invite (invite.username)}
                    <li
                      class="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm text-green-700 ring-1 ring-green-200/60 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-700/60"
                    >
                      <ion-icon name="checkmark-circle" style="font-size: 16px;"
                      ></ion-icon>
                      <span class="font-medium">{invite.username}</span>
                      <span class="text-xs">{teamRoleLabels[invite.role]}</span>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>

            <div class="flex items-center justify-end">
              <button
                type="button"
                onclick={finishTeam}
                class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-white font-semibold hover:bg-blue-700 transition"
              >
                Finish
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/key}
  </div>
</div>
