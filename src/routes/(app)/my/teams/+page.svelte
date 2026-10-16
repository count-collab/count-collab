<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { slugify } from "$lib/counter";
  import { teamRoleLabels } from "$lib/roles";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const roleBadgeClasses: Record<string, string> = {
    owner:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-700/60",
    admin:
      "bg-purple-50 text-purple-700 ring-1 ring-purple-200/60 dark:bg-purple-900/30 dark:text-purple-400 dark:ring-purple-700/60",
  };
  const defaultRoleBadgeClass =
    "bg-slate-50 text-slate-600 ring-1 ring-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/60";
</script>

<MetaTags
  title="My Teams | Count Collab"
  description="Teams you belong to and the counters and dashboards they share."
  path="/my/teams"
/>

<section>
  <div class="flex items-center justify-between gap-2 mb-4">
    <div class="flex items-center gap-2">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Teams
      </h2>
      <span
        class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"
      >
        {data.teams.length}
      </span>
    </div>
    <a
      href="/create?type=team"
      class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-1.5"
    >
      <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
      Create team
    </a>
  </div>

  {#if data.teams.length === 0}
    <div
      class="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center"
    >
      <ion-icon
        name="people-outline"
        class="text-slate-300 dark:text-slate-600"
        style="font-size: 40px;"
      ></ion-icon>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Share a group of counters and dashboards with the same people.
      </p>
      <a
        href="/create?type=team"
        class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        <ion-icon name="add-circle-outline" style="font-size: 16px;"></ion-icon>
        Create your first team
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each data.teams as team (team.id)}
        <a
          href={`/t/${team.id}/${slugify(team.name)}`}
          class="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-5 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg hover:ring-blue-100 dark:hover:ring-blue-900 hover:-translate-y-0.5 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <span
            class="relative font-semibold text-slate-900 dark:text-slate-100 truncate"
          >
            {team.name}
          </span>
          <span
            class="relative text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate min-h-5"
          >
            {team.description ?? ""}
          </span>
          <div
            class="relative flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400"
          >
            <span class="inline-flex items-center gap-1">
              <ion-icon name="people-outline" style="font-size: 14px;"
              ></ion-icon>
              {team.memberCount}
              {team.memberCount === 1 ? "member" : "members"}
            </span>
            <span class="inline-flex items-center gap-1">
              <ion-icon name="pulse-outline" style="font-size: 14px;"
              ></ion-icon>
              {team.counterCount}
              {team.counterCount === 1 ? "counter" : "counters"}
            </span>
            <span class="inline-flex items-center gap-1">
              <ion-icon name="apps-outline" style="font-size: 14px;"></ion-icon>
              {team.dashboardCount}
              {team.dashboardCount === 1 ? "dashboard" : "dashboards"}
            </span>
          </div>
          <div class="relative flex flex-wrap gap-1.5 mt-2">
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full {roleBadgeClasses[
                team.role
              ] ?? defaultRoleBadgeClass}"
            >
              {teamRoleLabels[team.role]}
            </span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</section>
