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
    checking = value.length >= 3;
    if (checking) {
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
          if (username === value) {
            checking = false;
          }
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

<div class="max-w-md mx-auto space-y-8 pt-12 px-4">
  <header class="text-center space-y-2">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">Welcome!</h1>
    <p class="text-slate-600 dark:text-slate-400">Choose a username to get started.</p>
  </header>

  <form method="POST" use:enhance class="space-y-6">
    <div class="space-y-1">
      <label class="sr-only" for="username">Username</label>
      <div class="relative">
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
          aria-describedby="username-hint username-status"
          aria-invalid={available === false || !!form?.error}
          class="w-full bg-transparent border-0 border-b-2 border-slate-300 dark:border-slate-600 text-2xl font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-0 pr-9 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-0"
        />
        <div
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center"
          aria-hidden="true"
        >
          {#if checking}
            <svg
              class="animate-spin h-5 w-5 text-green-600 dark:text-green-400"
              data-testid="username-checking"
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
          {:else if available === true}
            <ion-icon
              name="checkmark-circle"
              data-testid="username-available"
              class="text-2xl text-green-600 dark:text-green-400"
            ></ion-icon>
          {:else if available === false}
            <ion-icon
              name="close-circle"
              data-testid="username-taken"
              class="text-2xl text-red-600 dark:text-red-400"
            ></ion-icon>
          {/if}
        </div>
      </div>
      <p id="username-hint" class="text-xs text-slate-500 dark:text-slate-400">
        3–30 characters, letters, numbers, and underscores only.
      </p>
      <p id="username-status" class="sr-only" aria-live="polite">
        {#if checking}
          Checking availability
        {:else if available === true}
          Username is available
        {:else if available === false}
          Username is already taken
        {/if}
      </p>

      {#if form?.error}
        <p role="alert" class="text-sm text-red-600 dark:text-red-400">{form.error}</p>
      {/if}
    </div>

    <div class="flex justify-end">
      <button
        type="submit"
        disabled={username.length < 3 || available === false}
        class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  </form>
</div>
