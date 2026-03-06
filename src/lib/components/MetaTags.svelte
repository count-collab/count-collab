<script lang="ts">
  import { page } from "$app/stores";

  const {
    title,
    description,
    path,
  }: {
    title: string;
    description: string;
    path?: string;
  } = $props();

  const canonicalUrl = $derived(
    path !== undefined ? `${$page.url.origin}${path}` : $page.url.href,
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Count Collab" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonicalUrl} />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>
