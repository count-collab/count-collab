<script lang="ts">
  import { goto } from "$app/navigation";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { rateLimit } from "$lib/stores/ratelimit";

  let title = $state("");
  let description = $state("");
  let visibility = $state<"public" | "private">("public");
  let errors = $state<Record<string, string>>({});
  let isSubmitting = $state(false);

  async function handleSubmit() {
    if (isSubmitting) return;
    isSubmitting = true;
    errors = {};

    try {
      const response = await fetch("/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, visibility }),
      });

      if (!response.ok) {
        const body = await response.json();

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = body.retryAfterSeconds ?? 60;
          rateLimit.setLimit("/create", retryAfter);
          errors = {
            general: `Too many requests. Please try again in ${retryAfter} seconds.`,
          };
          return;
        }

        errors = body.errors ?? { general: "Failed to create counter." };
        return;
      }

      const result: { id: string } = await response.json();
      await goto(`/c/${result.id}`);
    } catch {
      errors = { general: "Network error. Please try again." };
    } finally {
      isSubmitting = false;
    }
  }
</script>

<MetaTags
  title="Create Counter | Count Collab"
  description="Create a new shareable counter and track anything in real-time."
  path="/create"
/>

<div class="max-w-2xl mx-auto space-y-8">
  <header class="space-y-2">
    <h1 class="text-3xl font-bold text-slate-900">Create a counter</h1>
    <p class="text-slate-600">
      Start a new counter and share the link with everyone.
    </p>
  </header>

  <form
    onsubmit={handleSubmit}
    class="space-y-6 bg-white rounded-lg shadow p-6"
  >
    <div class="space-y-2">
      <label class="block text-sm font-semibold text-slate-700" for="title"
        >Title</label
      >
      <input
        id="title"
        type="text"
        required
        bind:value={title}
        placeholder="Community donations"
        class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
      />
      {#if errors.title}
        <p class="text-sm text-red-600">{errors.title}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label
        class="block text-sm font-semibold text-slate-700"
        for="description">Description</label
      >
      <textarea
        id="description"
        rows="4"
        bind:value={description}
        placeholder="Add a short note about what this counter tracks"
        class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
      ></textarea>
    </div>

    <div class="space-y-2">
      <span class="block text-sm font-semibold text-slate-700">Visibility</span>
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" value="public" bind:group={visibility} />
          Public
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" value="private" bind:group={visibility} />
          Private (shareable link)
        </label>
      </div>
    </div>

    {#if errors.general}
      <p class="text-sm text-red-600">{errors.general}</p>
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
          Create counter
        {/if}
      </button>
      <a href="/" class="text-sm text-slate-600 hover:text-slate-900">Cancel</a>
    </div>
  </form>
</div>
