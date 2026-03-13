<script lang="ts">
  import type { Dashboard } from "$lib/db/schema";

  type Props = {
    dashboard: Dashboard;
  };

  const { dashboard }: Props = $props();
</script>

<a
  href={`/dashboards/${dashboard.id}`}
  class="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md"
>
  <div class="flex items-center gap-2 mb-2">
    <span class="font-semibold text-slate-900 truncate flex-1">{dashboard.title}</span>
    {#if dashboard.isMain}
      <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
        Main
      </span>
    {/if}
  </div>
  {#if dashboard.description}
    <span class="text-sm text-slate-500 line-clamp-2">{dashboard.description}</span>
  {/if}
  <div class="flex gap-1.5 mt-auto pt-2">
    <span
      class="text-xs px-2 py-0.5 rounded-full {dashboard.isPublic
        ? 'bg-green-100 text-green-700'
        : 'bg-slate-100 text-slate-600'}"
    >
      {dashboard.isPublic ? "Public" : "Private"}
    </span>
  </div>
</a>
