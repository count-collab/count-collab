<script lang="ts">
  let {
    label,
    heading,
    description,
    actionLabel,
    actionHref,
  }: {
    label: string;
    heading: string;
    description: string;
    actionLabel: string;
    actionHref: string;
  } = $props();
</script>

<section class="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
  <div
    class="cta-panel flex flex-col items-start justify-between gap-8 rounded-2xl px-7 py-12 sm:px-12 sm:py-16 md:flex-row md:items-end"
  >
    <div>
      <p
        class="font-mono text-sm font-semibold uppercase tracking-wider text-blue-200"
      >
        {label}
      </p>
      <h2
        class="mt-4 max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl"
      >
        {heading}
      </h2>
      <p class="mt-4 max-w-lg leading-relaxed text-blue-100">{description}</p>
    </div>
    <a
      href={actionHref}
      class="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-lg bg-white px-6 py-3 font-semibold text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700"
    >
      {actionLabel} <span aria-hidden="true">&rarr;</span>
    </a>
  </div>
</section>

<style>
  .cta-panel {
    background: #1d4ed8;
    background-image: linear-gradient(120deg, #1d4ed8, #1e40af);
  }
</style>
