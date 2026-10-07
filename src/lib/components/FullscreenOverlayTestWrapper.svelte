<script lang="ts">
  import FullscreenOverlay from "./FullscreenOverlay.svelte";
  import Modal from "./Modal.svelte";

  let {
    open = $bindable(false),
    title = "Test Overlay",
    onclose,
    withFooter = false,
  }: {
    open?: boolean;
    title?: string;
    onclose?: () => void;
    withFooter?: boolean;
  } = $props();

  let confirmOpen = $state(false);
</script>

{#snippet footerContent()}
  <button type="button">Footer action</button>
{/snippet}

<button type="button" onclick={() => (open = true)}>Open overlay</button>

<FullscreenOverlay
  bind:open
  {title}
  {onclose}
  footer={withFooter ? footerContent : undefined}
>
  <p>Overlay content</p>
  <button type="button" onclick={() => (confirmOpen = true)}>
    Open confirm
  </button>
  <Modal bind:open={confirmOpen} title="Confirm">
    <p>Confirm content</p>
  </Modal>
</FullscreenOverlay>
