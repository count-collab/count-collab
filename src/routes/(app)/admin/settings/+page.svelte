<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Slider from "$lib/components/Slider.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  // Intentionally capture initial settings for form editing (not reactive)
  // svelte-ignore state_referenced_locally
  const s = data.settings;

  let counterCreationLimitAuth = $state(s.counterCreationLimitAuth);
  let counterCreationWindowAuth = $state(s.counterCreationWindowAuth);
  let counterCreationLimitUnauth = $state(s.counterCreationLimitUnauth);
  let counterCreationWindowUnauth = $state(s.counterCreationWindowUnauth);

  let dashboardCreationLimitAuth = $state(s.dashboardCreationLimitAuth);
  let dashboardCreationWindowAuth = $state(s.dashboardCreationWindowAuth);
  let dashboardCreationLimitUnauth = $state(s.dashboardCreationLimitUnauth);
  let dashboardCreationWindowUnauth = $state(s.dashboardCreationWindowUnauth);

  let incrementCooldownMsAuth = $state(s.incrementCooldownMsAuth);
  let incrementCooldownMsUnauth = $state(s.incrementCooldownMsUnauth);

  let isSaving = $state(false);
  let saveMessage = $state<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  let cooldownAuthDisplay = $derived(
    (incrementCooldownMsAuth / 1000).toFixed(1),
  );
  let cooldownUnauthDisplay = $derived(
    (incrementCooldownMsUnauth / 1000).toFixed(1),
  );

  async function save() {
    isSaving = true;
    saveMessage = null;

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterCreationLimitAuth,
          counterCreationWindowAuth,
          counterCreationLimitUnauth,
          counterCreationWindowUnauth,
          dashboardCreationLimitAuth,
          dashboardCreationWindowAuth,
          dashboardCreationLimitUnauth,
          dashboardCreationWindowUnauth,
          incrementCooldownMsAuth,
          incrementCooldownMsUnauth,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message ?? "Failed to save settings");
      }

      saveMessage = { type: "success", text: "Saved!" };
      setTimeout(() => {
        saveMessage = null;
      }, 3000);
    } catch (e) {
      saveMessage = {
        type: "error",
        text: e instanceof Error ? e.message : "Failed to save settings",
      };
    } finally {
      isSaving = false;
    }
  }
</script>

<MetaTags
  title="Global Settings | Admin | Count Collab"
  description="Configure global rate limits and cooldowns"
  path="/admin/settings"
/>

<div class="space-y-8">
  <div>
    <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
      Global Settings
    </h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      Configure rate limits and cooldowns for the platform.
    </p>
  </div>

  <!-- Counter Creation Rate Limits -->
  <section
    class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
  >
    <div class="flex items-center gap-2 mb-6">
      <ion-icon
        name="add-circle-outline"
        class="text-emerald-600 dark:text-emerald-400"
        style="font-size: 20px;"
      ></ion-icon>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Counter Creation
      </h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-4">
        <h3
          class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide"
        >
          Authenticated Users
        </h3>
        <Slider
          bind:value={counterCreationLimitAuth}
          min={1}
          max={20}
          step={1}
          label="Max counters"
        />
        <Slider
          bind:value={counterCreationWindowAuth}
          min={10}
          max={300}
          step={10}
          unit="s"
          label="Time window"
        />
      </div>
      <div class="space-y-4">
        <h3
          class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide"
        >
          Unauthenticated Users
        </h3>
        <Slider
          bind:value={counterCreationLimitUnauth}
          min={1}
          max={10}
          step={1}
          label="Max counters"
        />
        <Slider
          bind:value={counterCreationWindowUnauth}
          min={10}
          max={300}
          step={10}
          unit="s"
          label="Time window"
        />
      </div>
    </div>
  </section>

  <!-- Dashboard Creation Rate Limits -->
  <section
    class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
  >
    <div class="flex items-center gap-2 mb-6">
      <ion-icon
        name="grid-outline"
        class="text-blue-600 dark:text-blue-400"
        style="font-size: 20px;"
      ></ion-icon>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Dashboard Creation
      </h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-4">
        <h3
          class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide"
        >
          Authenticated Users
        </h3>
        <Slider
          bind:value={dashboardCreationLimitAuth}
          min={1}
          max={20}
          step={1}
          label="Max dashboards"
        />
        <Slider
          bind:value={dashboardCreationWindowAuth}
          min={10}
          max={300}
          step={10}
          unit="s"
          label="Time window"
        />
      </div>
      <div class="space-y-4">
        <h3
          class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide"
        >
          Unauthenticated Users
        </h3>
        <Slider
          bind:value={dashboardCreationLimitUnauth}
          min={1}
          max={10}
          step={1}
          label="Max dashboards"
        />
        <Slider
          bind:value={dashboardCreationWindowUnauth}
          min={10}
          max={300}
          step={10}
          unit="s"
          label="Time window"
        />
      </div>
    </div>
  </section>

  <!-- Increment/Decrement Cooldown -->
  <section
    class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
  >
    <div class="flex items-center gap-2 mb-2">
      <ion-icon
        name="time-outline"
        class="text-amber-600 dark:text-amber-400"
        style="font-size: 20px;"
      ></ion-icon>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Increment/Decrement Cooldown
      </h2>
    </div>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
      Minimum cooldown applied to all counters. Overridden by per-counter
      settings when higher.
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-2">
        <Slider
          bind:value={incrementCooldownMsAuth}
          min={100}
          max={60000}
          step={100}
          unit="ms"
          label="Authenticated users"
        />
        <p class="text-xs text-slate-400 dark:text-slate-500">
          = {cooldownAuthDisplay} seconds
        </p>
      </div>
      <div class="space-y-2">
        <Slider
          bind:value={incrementCooldownMsUnauth}
          min={1000}
          max={120000}
          step={1000}
          unit="ms"
          label="Unauthenticated users"
        />
        <p class="text-xs text-slate-400 dark:text-slate-500">
          = {cooldownUnauthDisplay} seconds
        </p>
      </div>
    </div>
  </section>

  <!-- Save -->
  <div class="flex items-center gap-4">
    <button
      onclick={save}
      disabled={isSaving}
      class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if isSaving}
        <ion-icon
          name="sync-outline"
          class="animate-spin"
          style="font-size: 16px;"
        ></ion-icon>
        Saving…
      {:else}
        Save Settings
      {/if}
    </button>

    {#if saveMessage}
      <span
        class="text-sm font-medium {saveMessage.type === 'success'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400'}"
      >
        {saveMessage.text}
      </span>
    {/if}
  </div>
</div>
