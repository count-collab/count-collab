<script lang="ts">
  import Modal from "./Modal.svelte";

  let {
    open = $bindable(false),
    title = "Test Modal",
    maxWidth,
    describedBy,
    onclose
  }: {
    open?: boolean;
    title?: string;
    maxWidth?: string;
    describedBy?: string;
    onclose?: () => void;
  } = $props();
</script>

<Modal bind:open {title} {maxWidth} {describedBy} {onclose}>
  <p>Modal content</p>
</Modal>
