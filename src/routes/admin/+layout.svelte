<script lang="ts">
  const { children } = $props();
</script>

<div class="space-y-6">
  <nav class="flex gap-4 border-b border-slate-200 pb-4">
    <a
      href="/admin"
      class="text-slate-700 hover:text-slate-900 font-semibold transition"
      >Dashboard</a
    >
    <a
      href="/admin/users"
      class="text-slate-700 hover:text-slate-900 font-semibold transition"
      >Users</a
    >
    <a
      href="/admin/counters"
      class="text-slate-700 hover:text-slate-900 font-semibold transition"
      >Counters</a
    >
  </nav>

  {@render children()}
</div>
