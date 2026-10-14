<script lang="ts">
  type SoleOwnedTeam = {
    id: string;
    name: string;
    memberCount: number;
    counterCount: number;
    dashboardCount: number;
  };

  const { teams, isSelf = true }: { teams: SoleOwnedTeam[]; isSelf?: boolean } =
    $props();

  // Teams with other members block deletion; the rest are deleted with the account
  const blocking = $derived(teams.filter((t) => t.memberCount > 1));
  const deleted = $derived(teams.filter((t) => t.memberCount <= 1));

  function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }
</script>

{#if blocking.length > 0}
  <div
    class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 space-y-2 text-sm"
    role="alert"
  >
    <p class="font-semibold text-red-800 dark:text-red-300 flex items-center gap-1.5">
      <ion-icon name="warning-outline" aria-hidden="true"></ion-icon>
      {isSelf ? "You are" : "This user is"} the only owner of {blocking.length === 1
        ? "a team that has"
        : "teams that have"} other members. The account cannot be deleted until
      ownership is transferred:
    </p>
    <ul class="list-disc pl-5 space-y-1 text-red-800 dark:text-red-300">
      {#each blocking as team (team.id)}
        <li>
          <a href="/t/{team.id}" class="font-medium underline hover:no-underline"
            >{team.name}</a
          >: {plural(team.memberCount, "member")}
        </li>
      {/each}
    </ul>
    <p class="text-red-700 dark:text-red-400">
      Promote another member to owner on the team page first.
    </p>
  </div>
{/if}

{#if deleted.length > 0}
  <div
    class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2 text-sm"
    role="alert"
  >
    <p class="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
      <ion-icon name="warning-outline" aria-hidden="true"></ion-icon>
      {isSelf ? "You are" : "This user is"} the only owner of {deleted.length === 1
        ? "this team"
        : "these teams"}. {deleted.length === 1 ? "It" : "They"} will be deleted:
    </p>
    <ul class="list-disc pl-5 space-y-1 text-amber-800 dark:text-amber-300">
      {#each deleted as team (team.id)}
        <li>
          <a href="/t/{team.id}" class="font-medium underline hover:no-underline"
            >{team.name}</a
          >: {plural(team.memberCount, "member")}, {plural(
            team.counterCount,
            "counter",
          )}, {plural(team.dashboardCount, "dashboard")} will be permanently deleted
        </li>
      {/each}
    </ul>
  </div>
{/if}
