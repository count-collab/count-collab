<script lang="ts">
  import FaqAccordion from "$lib/components/FaqAccordion.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import { faqItems } from "$lib/data/faq";

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  });
</script>

<MetaTags
  title="FAQ — Count Collab"
  description="Find answers to frequently asked questions about Count Collab: pricing, accounts, real-time sync, privacy, dashboards, and more."
  path="/faq"
/>

<svelte:head>
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-16 sm:py-24">
  <div class="text-center mb-12">
    <h1
      class="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100"
    >
      Frequently Asked Questions
    </h1>
    <p class="mt-4 text-lg text-slate-500 dark:text-slate-400">
      Everything you need to know about Count Collab.
    </p>
  </div>

  <FaqAccordion items={faqItems} />

  <div class="text-center mt-16">
    <p class="text-slate-500 dark:text-slate-400">
      Still have questions? <a
        href="/create?type=counter"
        class="text-blue-600 dark:text-blue-400 font-medium hover:underline"
        >Try it out</a
      > — it's free.
    </p>
  </div>
</div>
