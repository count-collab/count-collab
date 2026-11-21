<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
  import CallToAction from "$lib/components/marketing/CallToAction.svelte";
  import Hero from "$lib/components/marketing/Hero.svelte";
  import Intro from "$lib/components/marketing/Intro.svelte";
  import SectionLabel from "$lib/components/marketing/SectionLabel.svelte";
  import Steps from "$lib/components/marketing/Steps.svelte";
  import UseCaseCards from "$lib/components/marketing/UseCaseCards.svelte";
  import TallyClickerIllustration from "$lib/components/TallyClickerIllustration.svelte";

  const useCases = [
    {
      label: "01 / EVENTS",
      title: "Events and attendance",
      description:
        "Bring the hand clicker idea to your whole crew. Keep a shared headcount at the entrance, across rooms, or between event staff.",
    },
    {
      label: "02 / EDUCATION",
      title: "Classroom participation",
      description:
        "Turn a classroom tally into a count everyone can follow. Track questions, votes, or participation as they happen.",
    },
    {
      label: "03 / GROUPS",
      title: "Team goals and collections",
      description:
        "Make progress visible as your group works toward a shared target.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Name your counter",
      description: "Set up a counter for the thing you want to track.",
    },
    {
      number: "02",
      title: "Share one link",
      description: "Send it to the people helping you keep the tally.",
    },
    {
      number: "03",
      title: "Watch it update",
      description:
        "See every change reflected for everyone viewing the counter.",
    },
  ];
</script>

<MetaTags
  title="Free Online Tally Counter - Count Together | Count Collab"
  description="The simplicity of a tally clicker or paper tally, now shared online. Create a free tally counter, share one link, and count together in real time."
  path="/tally-counter"
/>

<div class="overflow-hidden bg-slate-50 dark:bg-slate-900">
  <Hero
    label="Count Collab / Online tally"
    description="All the simplicity of a handheld clicker or a tally on paper, with everyone on the same count. Create a free online tally counter, share one link, and keep counting together from any device."
    primaryLabel="Create a tally counter"
    primaryHref="/create?type=counter"
    secondaryLabel="How it works"
    secondaryHref="/how-it-works"
    note="Free to use. Public counters don't require an account."
  >
    {#snippet title()}
      A tally counter for <span class="text-blue-600 dark:text-blue-400"
        >counting together</span
      >
    {/snippet}
    {#snippet primaryIcon()}
      <ion-icon name="arrow-forward-outline" aria-hidden="true"></ion-icon>
    {/snippet}
    <TallyClickerIllustration />
  </Hero>

  <Intro label="One count, shared">
    {#snippet heading()}From clickers and tally sheets to one shared count{/snippet}
    <p>
      A thumb on a clicker, a mark on a sheet, a tap on a screen: a tally
      counter keeps a running total, one at a time. Use it for visitors through
      a door, questions in a session, items collected, or progress toward a
      group goal.
    </p>
    <p>
      Count Collab brings that familiar idea online, so the total doesn't stay
      in one person's hand or notebook. Open the same counter on multiple
      devices and each change syncs in real time. For a public counter, anyone
      with the link can join without installing an app or signing up.
    </p>
  </Intro>

  <section
    class="mx-auto max-w-7xl space-y-20 px-4 py-20 sm:space-y-28 sm:px-6 sm:py-28 lg:px-8"
    aria-labelledby="tally-uses-heading tally-steps-heading"
  >
    <div>
      <div class="mb-12 max-w-2xl">
        <SectionLabel text="Made for everyday counting" />
        <h2
          id="tally-uses-heading"
          class="mt-5 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
        >
          A simple tally, useful anywhere
        </h2>
      </div>
      <UseCaseCards items={useCases} />
    </div>
    <div class="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
      <div>
        <SectionLabel text="Get started in three steps" />
        <h2
          id="tally-steps-heading"
          class="mt-5 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
        >
          Create, share, count
        </h2>
      </div>
      <Steps {steps} compact />
    </div>
  </section>

  <CallToAction
    label="Start your tally"
    heading="Make the count a team effort."
    description="No clicker to pass around. No tallies to add up later. Just one counter shared with the people counting alongside you."
    actionLabel="Create a tally counter"
    actionHref="/create?type=counter"
  />

  <p
    class="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400 sm:px-6 lg:px-8"
  >
    Looking for more ideas? Browse our
    <a
      class="font-semibold text-blue-600 underline underline-offset-4 dark:text-blue-400"
      href="/use-cases"
    >
      shared counter use cases
    </a>.
  </p>
</div>
