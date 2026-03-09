<script lang="ts">
  import { enhance } from "$app/forms";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import type { ActionData, PageData } from "./$types";

  const { data, form }: { data: PageData; form: ActionData } = $props();

  const initialUsername = $derived(form?.username ?? "");
  let username = $state("");
  $effect(() => {
    username = initialUsername;
  });
  let checking = $state(false);
  let available = $state<boolean | null>(null);
  let checkTimeout: ReturnType<typeof setTimeout>;

  function handleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    username = value;
    available = null;

    clearTimeout(checkTimeout);
    if (value.length >= 3) {
      checking = true;
      checkTimeout = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/username/check?username=${encodeURIComponent(value)}`,
          );
          const result = await res.json();
          if (username === value) {
            available = result.available;
          }
        } catch {
          available = null;
        } finally {
          checking = false;
        }
      }, 400);
    }
  }
</script>

<MetaTags
  title="Choose Username | Count Collab"
  description="Pick a unique username for your Count Collab account."
  path="/setup"
/>

<div class="max-w-md mx-auto space-y-8 pt-12">
  <header class="text-center space-y-2">
    <h1 class="text-3xl font-bold text-slate-900">Welcome!</h1>
    <p class="text-slate-600">Choose a username to get started.</p>
  </header>

  <form
    method="POST"
    use:enhance
    class="space-y-6 bg-white rounded-lg shadow p-6"
  >
    <div class="space-y-2">
      <label class="block text-sm font-semibold text-slate-700" for="username">
        Username
      </label>
      <input
        id="username"
        name="username"
        type="text"
        required
        minlength="3"
        maxlength="30"
        pattern="[a-zA-Z0-9_]+"
        value={username}
        oninput={handleInput}
        placeholder="your_username"
        autocomplete="off"
        class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
      />
      <p class="text-xs text-slate-500">
        3–30 characters, letters, numbers, and underscores only.
      </p>

      {#if checking}
        <p class="text-sm text-slate-500">Checking availability...</p>
      {:else if available === true}
        <p class="text-sm text-green-600">Username is available!</p>
      {:else if available === false}
        <p class="text-sm text-red-600">Username is already taken.</p>
      {/if}

      {#if form?.error}
        <p class="text-sm text-red-600">{form.error}</p>
      {/if}
    </div>

    <button
      type="submit"
      disabled={username.length < 3 || available === false}
      class="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Continue
    </button>
  </form>
</div>
