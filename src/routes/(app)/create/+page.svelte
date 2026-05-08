<script lang="ts">
  
  import posthog from "posthog-js";
import { untrack } from "svelte";
  import { fly } from "svelte/transition";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import type {
    CounterMode,
    CounterVisibilityMode,
    DashboardVisibilityMode,
  } from "$lib/db/schema";
  import { rateLimit } from "$lib/stores/ratelimit";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  type CreationType = "counter" | "dashboard";

  const isLoggedIn = $derived(!!data.session?.user);

  const initialType = untrack(() => {
    const t = (data as Record<string, unknown>).preselectedType;
    return t === "counter" || t === "dashboard" ? (t as CreationType) : null;
  });
  const skippedStep1 = !!initialType;
  const totalSteps = $derived.by(() => {
    const isCounter = creationType === "counter";
    if (skippedStep1) return isCounter ? 3 : 2;
    return isCounter ? 4 : 3;
  });

  let creationType = $state<CreationType | null>(initialType);
  let counterMode = $state<CounterMode>("increment_only");
  let visibility = $state<
    CounterVisibilityMode | DashboardVisibilityMode | null
  >(null);
  let title = $state("");
  let description = $state("");
  let errors = $state<Record<string, string>>({});
  let isSubmitting = $state(false);
  const canGoBack = browser && window.history.length > 1;

  // Step management
  let currentStep = $state(skippedStep1 ? 2 : 1);
  let direction = $state<"forward" | "backward">("forward");

  const flyX = $derived(direction === "forward" ? 300 : -300);

  const typeLabel = $derived(
    creationType === "dashboard" ? "dashboard" : "counter",
  );

  // Map step to display dot index
  const displayStep = $derived(skippedStep1 ? currentStep - 1 : currentStep);

  function selectType(type: CreationType) {
    creationType = type;
    direction = "forward";
    setTimeout(() => {
      currentStep = 2;
    }, 300);
  }

  const detailsStep = $derived(creationType === "counter" ? 4 : 3);

  function selectVisibility(
    v: CounterVisibilityMode | DashboardVisibilityMode,
  ) {
    visibility = v;
    direction = "forward";
    setTimeout(() => {
      currentStep = 3;
    }, 300);
  }

  function selectCounterMode(mode: CounterMode) {
    counterMode = mode;
    direction = "forward";
    setTimeout(() => {
      currentStep = 4;
    }, 300);
  }

  function goBack() {
    direction = "backward";
    if (currentStep === detailsStep) {
      currentStep = creationType === "counter" ? 3 : 2;
    } else if (currentStep === 3 && creationType === "counter") {
      currentStep = 2;
    } else if (currentStep === 2 && !skippedStep1) {
      currentStep = 1;
    }
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

        errors = body.errors ?? { general: `Failed to create ${typeLabel}.` };
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
  description="Create a new counter or dashboard and share it in real-time."
  path="/create"
/>

<div class="w-full max-w-2xl mx-auto px-4 flex flex-col justify-center flex-1">
  <!-- Top bar: back button + step dots -->
  <div class="flex items-center pt-2 mb-8">
    <button
      type="button"
      onclick={goBack}
      class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 flex items-center gap-1 {(currentStep ===
        2 &&
        !skippedStep1) ||
      currentStep >= 3
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
        {#if currentStep === 1}
          <!-- Step 1: Choose type -->
          <div class="space-y-6">
            <header class="space-y-2 text-center">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                What do you want to create?
              </h1>
            </header>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <span class="text-sm text-slate-600 dark:text-slate-400"
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
                  <span class="text-sm text-slate-600 dark:text-slate-400"
                    >Group multiple counters in one view</span
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
        {:else if currentStep === 2}
          <!-- Step 2: Choose visibility -->
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
        {:else if currentStep === 3 && creationType === "counter"}
          <!-- Step 3: Counter Mode (counter only) -->
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
        {:else if currentStep === detailsStep}
          <!-- Step: Name & submit -->
          <div class="space-y-6">
            <header class="space-y-1 text-center">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Name your {typeLabel}
              </h1>
              <p class="text-slate-600 dark:text-slate-400">
                You can always change this later.
              </p>
            </header>

            {#if errors.general}
              <div
                class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400"
              >
                {errors.general}
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
        {/if}
      </div>
    {/key}
  </div>
</div>
