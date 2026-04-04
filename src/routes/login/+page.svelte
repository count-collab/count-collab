<script lang="ts">
  import { signIn } from "@auth/sveltekit/client";
  import { page } from "$app/state";
  import MetaTags from "$lib/components/MetaTags.svelte";

  const errorMessages: Record<string, string> = {
    OAuthAccountNotLinked:
      "This email is already associated with another provider. Please sign in with the original provider.",
    OAuthCallbackError:
      "Something went wrong during sign-in. Please try again.",
    OAuthSignin: "Could not start the sign-in flow. Please try again.",
    Default: "An unexpected error occurred. Please try again.",
  };

  let errorParam = $derived(page.url.searchParams.get("error"));
  let errorMessage = $derived(
    errorParam ? (errorMessages[errorParam] ?? errorMessages.Default) : null,
  );

  const providers = [
    {
      id: "google",
      name: "Google",
      icon: "logo-google",
      bg: "bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700",
      text: "text-slate-900 dark:text-slate-100",
    },
    {
      id: "discord",
      name: "Discord",
      icon: "logo-discord",
      bg: "bg-[#5865F2] hover:bg-[#4752C4]",
      text: "text-white",
    },
    {
      id: "twitch",
      name: "Twitch",
      icon: "logo-twitch",
      bg: "bg-[#9146FF] hover:bg-[#7B2FFF]",
      text: "text-white",
    },
  ];
</script>

<MetaTags
  title="Sign In | Count Collab"
  description="Sign in to Count Collab to create and manage your counters."
  path="/login"
/>

<div class="max-w-sm mx-auto pt-16 space-y-8">
  <header class="text-center space-y-2">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100">Sign in</h1>
    <p class="text-slate-600 dark:text-slate-400">Sign in to create and manage counters.</p>
  </header>

  {#if errorMessage}
    <div
      class="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
    >
      {errorMessage}
    </div>
  {/if}

  <div class="space-y-3">
    {#each providers as provider (provider.id)}
      <button
        type="button"
        onclick={() => signIn(provider.id, { callbackUrl: "/my-counters" })}
        class="w-full flex items-center justify-center gap-3 rounded-lg px-5 py-3 font-semibold transition {provider.bg} {provider.text}"
      >
        <ion-icon name={provider.icon} style="font-size: 22px;"></ion-icon>
        Continue with {provider.name}
      </button>
    {/each}
  </div>

  <p class="text-center text-sm text-slate-500 dark:text-slate-400">
    You can also <a href="/" class="text-blue-600 dark:text-blue-400 hover:underline"
      >browse and use counters</a
    > without signing in.
  </p>
</div>
