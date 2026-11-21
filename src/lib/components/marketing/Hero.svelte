<script lang="ts">
  import type { Snippet } from "svelte";
  import SectionLabel from "./SectionLabel.svelte";

  let {
    label,
    title,
    description,
    primaryLabel,
    primaryHref,
    primaryIcon,
    secondaryLabel,
    secondaryHref,
    note,
    children,
  }: {
    label: string;
    title: Snippet;
    description: string;
    primaryLabel: string;
    primaryHref: string;
    primaryIcon?: Snippet;
    secondaryLabel: string;
    secondaryHref: string;
    note: string;
    children: Snippet;
  } = $props();
</script>

<section class="marketing-hero relative overflow-hidden">
  <div
    class="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:px-8 lg:pb-28"
  >
    <div class="max-w-2xl self-start">
      <SectionLabel text={label} />
      <h1
        class="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tight text-slate-950 dark:text-white sm:text-6xl lg:text-7xl"
      >
        {@render title()}
      </h1>
      <p
        class="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300"
      >
        {description}
      </p>
      <div class="mt-9 flex flex-wrap items-center gap-4">
        <a
          href={primaryHref}
          class="inline-flex min-h-12 items-center gap-3 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {primaryLabel}
          {#if primaryIcon}
            {@render primaryIcon()}
          {:else}
            <span aria-hidden="true">&rarr;</span>
          {/if}
        </a>
        <a
          href={secondaryHref}
          class="inline-flex min-h-12 items-center font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-blue-600 dark:text-slate-200 dark:decoration-slate-600 dark:hover:text-blue-400"
        >
          {secondaryLabel}
        </a>
      </div>
      <p class="mt-5 text-sm text-slate-500 dark:text-slate-400">{note}</p>
    </div>
    {@render children()}
  </div>
</section>

<style>
  .marketing-hero {
    background-image:
      linear-gradient(to right, rgb(37 99 235 / 0.045) 1px, transparent 1px),
      linear-gradient(to bottom, rgb(37 99 235 / 0.045) 1px, transparent 1px);
    background-size: 48px 48px;
  }
</style>
