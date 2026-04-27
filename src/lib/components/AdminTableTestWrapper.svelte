<script lang="ts">
  type Column = {
    key: string;
    label: string;
    sortable?: boolean;
    align?: "left" | "right";
  };

  import AdminTable from "./AdminTable.svelte";

  let {
    columns = [],
    currentSort,
    currentOrder,
    baseUrl = "/admin/counters",
    extraParams,
  }: {
    columns?: Column[];
    currentSort?: string;
    currentOrder?: "asc" | "desc";
    baseUrl?: string;
    extraParams?: Record<string, string>;
  } = $props();
</script>

<AdminTable {columns} {currentSort} {currentOrder} {baseUrl} {extraParams}>
  {#snippet rows()}
    <tr><td>Row 1</td></tr>
    <tr><td>Row 2</td></tr>
  {/snippet}
</AdminTable>
