<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<MetaTags
  title="Admin Dashboard | Count Collab"
  description="Admin dashboard"
  path="/admin"
/>

<h1 class="text-3xl font-bold text-slate-900">Admin Dashboard</h1>

<div class="grid grid-cols-2 gap-6 mt-6">
  <div class="bg-white rounded-lg shadow p-6">
    <p class="text-sm text-slate-500">Total Users</p>
    <p class="text-4xl font-bold text-blue-600">{data.stats.userCount}</p>
  </div>
  <div class="bg-white rounded-lg shadow p-6">
    <p class="text-sm text-slate-500">Total Counters</p>
    <p class="text-4xl font-bold text-blue-600">{data.stats.counterCount}</p>
  </div>
</div>
