<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { slugify } from "$lib/counter";
  import { teamRoleLabels } from "$lib/roles";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const teamUrl = $derived(`/t/${data.team.id}/${slugify(data.team.name)}`);

  let isJoining = $state(false);
  let joinError = $state<string | null>(null);

  async function handleJoin() {
    if (isJoining) return;
    isJoining = true;
    joinError = null;

    try {
      const response = await fetch(`/api/teams/${data.team.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: $page.url.searchParams.get("token") }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        joinError = body.error ?? body.message ?? "Failed to join team.";
        return;
      }

      await goto(teamUrl, { invalidateAll: true });
    } catch {
      joinError = "Network error. Please try again.";
    } finally {
      isJoining = false;
    }
  }
</script>

<MetaTags
  title="Join {data.team.name} | Count Collab"
  description="You've been invited to join a team on Count Collab."
  path="/t/{data.team.id}/join"
/>

<div class="flex justify-center py-12">
  <section
    class="w-full max-w-md bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4 text-center"
  >
    <ion-icon
      name="people-outline"
      class="text-blue-600 dark:text-blue-400"
      style="font-size: 40px;"
    ></ion-icon>

    {#if data.alreadyMember}
      <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100">
        You're already a member
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        You already belong to <span class="font-semibold">{data.team.name}</span>.
      </p>
      <a
        href={teamUrl}
        class="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
      >
        Go to team
        <ion-icon name="arrow-forward-outline" style="font-size: 16px;"
        ></ion-icon>
      </a>
    {:else}
      <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 break-words">
        Join {data.team.name} as {teamRoleLabels[data.role]}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        You'll get access to the team's counters and dashboards.
      </p>
      <div aria-live="polite">
        {#if joinError}
          <p role="alert" class="text-sm text-red-600 dark:text-red-400">
            {joinError}
          </p>
        {/if}
      </div>
      <button
        type="button"
        onclick={handleJoin}
        disabled={isJoining}
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isJoining ? "Joining…" : "Join team"}
      </button>
    {/if}
  </section>
</div>
