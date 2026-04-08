<script lang="ts">
  import { goto } from "$app/navigation";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import type { DashboardVisibilityMode } from "$lib/db/schema";
  import { rateLimit } from "$lib/stores/ratelimit";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const isLoggedIn = $derived(!!data.session?.user);
  const visibilityHelpText: Record<DashboardVisibilityMode, string> = {
    public: "Anyone with the link can view.",
    public_readonly: "Anyone can view. Only members can edit.",
    private:
      "Only invited members or people with the private link can access it.",
  };

  let title = $state("");
  let description = $state("");
  let visibility = $state<DashboardVisibilityMode>("public");
  let errors = $state<Record<string, string>>({});
  let isSubmitting = $state(false);

  $effect(() => {
    if (!isLoggedIn && visibility !== "public") {
      visibility = "public";
    }
  });

  async function handleSubmit() {
    if (isSubmitting) return;
    isSubmitting = true;
    errors = {};

    try {
      const response = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, visibility }),
      });

      if (!response.ok) {
        const body = await response.json();

        if (response.status === 429) {
          const retryAfter = body.retryAfterSeconds ?? 60;
          rateLimit.setLimit("/api/dashboards", retryAfter);
          errors = {
            general: `Too many requests. Please try again in ${retryAfter} seconds.`,
          };
          return;
        }

        errors = body.errors ?? { general: "Failed to create dashboard." };
        return;
      }

      const result: { id: string } = await response.json();
      await goto(`/d/${result.id}`);
    } catch {
      errors = { general: "Network error. Please try again." };
    } finally {
      isSubmitting = false;
    }
  }
</script>

<MetaTags
  title="Create Dashboard | Count Collab"
  description="Create a new dashboard to group and display counters together."
  path="/create/dashboard"
/>

<div class="sm:max-w-2xl sm:mx-auto space-y-8">
  <header class="space-y-2">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">
      Create a dashboard
    </h1>
    <p class="text-slate-600 dark:text-slate-400">
      Group counters together and share them as a single view.
    </p>
  </header>

  <form
    onsubmit={handleSubmit}
    class="space-y-6 sm:bg-white sm:rounded-lg sm:shadow sm:p-6 sm:dark:bg-slate-800 sm:dark:shadow-slate-900/50"
  >
    <div class="space-y-2">
      <label
        class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        for="title">Title</label
      >
      <input
        id="title"
        type="text"
        required
        bind:value={title}
        placeholder="My project dashboard"
        class="w-full rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400 dark:placeholder:text-slate-500"
      />
      {#if errors.title}
        <p class="text-sm text-red-600 dark:text-red-400">{errors.title}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label
        class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        for="description">Description</label
      >
      <textarea
        id="description"
        rows="4"
        bind:value={description}
        placeholder="Add a short note about what this dashboard shows"
        class="w-full rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400 dark:placeholder:text-slate-500"
      ></textarea>
    </div>

    <div class="space-y-2">
      <span
        class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        >Visibility</span
      >
      <div
        class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
      >
        <label
          class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <input
            type="radio"
            value="public"
            bind:group={visibility}
            class="accent-blue-600"
          />
          Public
        </label>
        {#if isLoggedIn}
          <label
            class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <input
              type="radio"
              value="public_readonly"
              bind:group={visibility}
              class="accent-blue-600"
            />
            Public (read-only)
          </label>
          <label
            class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <input
              type="radio"
              value="private"
              bind:group={visibility}
              class="accent-blue-600"
            />
            Private (shareable link)
          </label>
        {:else}
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Sign in to create public read-only or private dashboards.
          </p>
        {/if}
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        {visibilityHelpText[visibility]}
      </p>
    </div>

    {#if errors.general}
      <p class="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
    {/if}

    <div class="flex items-center gap-3">
      <button
        type="submit"
        disabled={isSubmitting || $rateLimit.isLimited}
        class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if $rateLimit.isLimited}
          Try again in {$rateLimit.retryAfterSeconds}s
        {:else}
          Create dashboard
        {/if}
      </button>
      <a
        href="/"
        class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >Cancel</a
      >
    </div>
  </form>
</div>
