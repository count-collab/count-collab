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

  function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }
</script>

<div
  class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2 text-sm"
  role="alert"
>
  <p class="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
    <ion-icon name="warning-outline" aria-hidden="true"></ion-icon>
    {isSelf ? "You are" : "This user is"} the only owner of {teams.length === 1
      ? "this team"
      : "these teams"}. {teams.length === 1 ? "It" : "They"} will be deleted:
  </p>
  <ul class="list-disc pl-5 space-y-1 text-amber-800 dark:text-amber-300">
    {#each teams as team (team.id)}
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
  <p class="text-amber-700 dark:text-amber-400">
    To keep a team, promote another member to owner on the team page first.
  </p>
</div>
