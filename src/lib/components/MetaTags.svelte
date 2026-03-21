<script lang="ts">
  import { page } from "$app/stores";

  const {
    title,
    description,
    path,
    image,
  }: {
    title: string;
    description: string;
    path?: string;
    image?: string;
  } = $props();

  const canonicalUrl = $derived(
    path !== undefined ? `${$page.url.origin}${path}` : $page.url.href,
  );

  const imageUrl = $derived(
    image ? (image.startsWith("http") ? image : `${$page.url.origin}${image}`) : undefined,
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
  {#if imageUrl}
    <meta property="og:image" content={imageUrl} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
  {/if}

  <!-- Twitter Card -->
  <meta name="twitter:card" content={imageUrl ? "summary_large_image" : "summary"} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  {#if imageUrl}
    <meta name="twitter:image" content={imageUrl} />
  {/if}
</svelte:head>
