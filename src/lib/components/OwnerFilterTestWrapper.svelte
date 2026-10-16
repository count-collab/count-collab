<script lang="ts">
  import OwnerFilter from "./OwnerFilter.svelte";

  let {
    value = $bindable("all"),
    teams,
  }: {
    value?: string;
    teams: { id: string; name: string }[];
  } = $props();
</script>

<OwnerFilter bind:value {teams} />
<output data-testid="selected">{value}</output>
