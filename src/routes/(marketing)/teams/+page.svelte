<script lang="ts">
  import MetaTags from "$lib/components/MetaTags.svelte";
  import CallToAction from "$lib/components/marketing/CallToAction.svelte";
  import Hero from "$lib/components/marketing/Hero.svelte";
  import Intro from "$lib/components/marketing/Intro.svelte";
  import SectionLabel from "$lib/components/marketing/SectionLabel.svelte";
  import Steps from "$lib/components/marketing/Steps.svelte";
  import UseCaseCards from "$lib/components/marketing/UseCaseCards.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
  const createTeamHref = $derived(
    data.session?.user
      ? "/create?type=team"
      : "/login?redirectTo=%2Fcreate%3Ftype%3Dteam",
  );

  const steps = [
    {
      number: "01",
      title: "Make a space",
      description: "Create a team for your department, project, or crew.",
    },
    {
      number: "02",
      title: "Bring your people",
      description:
        "Invite colleagues by username or share a join link with a role you choose.",
    },
    {
      number: "03",
      title: "Bring your counts",
      description:
        "Create counters and dashboards in the team, or move existing ones in.",
    },
    {
      number: "04",
      title: "Count together",
      description:
        "Update counts as work happens and see changes across connected devices.",
    },
  ];

  const roles = [
    { name: "Viewer", description: "See counters and dashboards" },
    { name: "Incrementer", description: "View and update counts" },
    { name: "Editor", description: "Create and edit resources" },
    { name: "Admin", description: "Manage resources and members" },
    { name: "Owner", description: "Control ownership and the team" },
  ];

  const useCases = [
    {
      label: "01 / OPERATIONS",
      title: "Keep work in view",
      description:
        "Count completed inspections or incoming deliveries. Put related counts on a dashboard for a shared overview.",
    },
    {
      label: "02 / EVENTS",
      title: "See every entrance",
      description:
        "Give staff counting access and track check-ins at different entrances while coordinators follow along.",
    },
    {
      label: "03 / COMMUNITY",
      title: "Make progress visible",
      description:
        "Bring volunteers together around counts for activities completed or items collected across a project.",
    },
  ];
</script>

<MetaTags
  title="Shared Counters for Teams | Count Collab"
  description="Bring your people, counters, and dashboards together. Track shared work in real time with Count Collab Teams."
  path="/teams"
/>

<div class="overflow-hidden bg-slate-50 dark:bg-slate-900">
  <Hero
    label="Count Collab / Teams"
    description="Give your people one shared place for the counters and dashboards that keep work moving. Add your team once, then count together in real time."
    primaryLabel="Create a team"
    primaryHref={createTeamHref}
    secondaryLabel="See how it works"
    secondaryHref="#how-it-works"
    note="Sign in to create or join a team."
  >
    {#snippet title()}
      Count together.<br />
      <span class="text-blue-600 dark:text-blue-400"
        >Stay on the same page.</span
      >
    {/snippet}
    <div class="workspace-wrap" aria-hidden="true">
      <div class="workspace-note">
        <span></span> An example team workspace
      </div>
      <div class="workspace">
        <div class="workspace-top">
          <div class="workspace-details">
            <div class="workspace-name">Operations team</div>
            <div class="workspace-description">
              Keeping work moving together
            </div>
            <div class="workspace-meta">
              <span>Owner</span> Created 12/10/2026
            </div>
          </div>
          <div class="workspace-actions">
            <span><ion-icon name="settings-outline"></ion-icon> Settings</span>
            <span><ion-icon name="log-out-outline"></ion-icon> Leave team</span>
          </div>
        </div>
        <div class="workspace-tabs">
          <div class="workspace-tab workspace-tab-active">
            <ion-icon name="pulse-outline"></ion-icon> Counters <span>3</span>
          </div>
          <div class="workspace-tab">
            <ion-icon name="apps-outline"></ion-icon> Dashboards
            <span>1</span>
          </div>
          <div class="workspace-tab">
            <ion-icon name="people-outline"></ion-icon> Members <span>3</span>
          </div>
        </div>
        <div class="workspace-content">
          <div class="workspace-toolbar">
            <span>+&nbsp; New counter</span>
          </div>
          <div class="workspace-grid">
            <div class="workspace-card">
              <strong>128</strong>
              <span>Inspections completed</span>
              <small>Quality checks</small>
            </div>
            <div class="workspace-card">
              <strong>46</strong>
              <span>Deliveries received</span>
              <small>Arrivals</small>
            </div>
            <div class="workspace-card">
              <strong>312</strong>
              <span>Customer visits</span>
              <small>Front desk</small>
            </div>
          </div>
        </div>
      </div>
      <div class="workspace-caption">ONE TEAM <span>/</span> MANY COUNTS</div>
    </div>
  </Hero>

  <Intro label="A better way to share">
    {#snippet heading()}Less sharing links.<br />More getting things done.{/snippet}
    <p>
      When a count lives in one person's spreadsheet or behind another link,
      keeping everyone in sync becomes work of its own.
    </p>
    <p>
      Teams brings your counters and dashboards under one shared roof. Your
      people get access through their team role, so you don't have to invite
      them to every resource one by one.
    </p>
    <p class="font-semibold text-blue-700 dark:text-blue-400">
      The team owns the work, not just the person who created it.
    </p>
  </Intro>

  <section
    id="how-it-works"
    class="border-y border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/40"
  >
    <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div>
          <SectionLabel text="Getting started" />
          <h2
            class="mt-5 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
          >
            From team to teamwork.
          </h2>
        </div>
        <p class="max-w-sm text-slate-600 dark:text-slate-400">
          Set up a shared space, then keep the numbers moving together.
        </p>
      </div>
      <div class="mt-12"><Steps {steps} /></div>
    </div>
  </section>

  <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
    <SectionLabel text="Made for shared work" />
    <div class="mt-5 flex flex-wrap items-end justify-between gap-6">
      <h2
        class="max-w-2xl text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
      >
        Whatever you're counting, count it together.
      </h2>
      <p class="max-w-sm text-slate-600 dark:text-slate-400">
        Simple counts can make the work happening across a group visible.
      </p>
    </div>
    <div class="mt-12"><UseCaseCards items={useCases} /></div>
  </section>

  <section class="bg-slate-900 text-white dark:bg-slate-950">
    <div
      class="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24 lg:px-8"
    >
      <div>
        <SectionLabel text="Access that fits" onDark />
        <h2 class="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          The right role for the work.
        </h2>
        <p class="mt-5 max-w-md text-lg leading-relaxed text-slate-300">
          Not everyone needs the same controls. Choose a role for each member
          and it carries over to the team's counters and dashboards.
        </p>
        <p class="mt-6 max-w-md text-sm leading-relaxed text-slate-400">
          Team pages are private, and new team counters and dashboards default
          to private. Individual resource visibility and share links can grant
          access beyond the team.
        </p>
      </div>
      <div class="border-t border-slate-700">
        {#each roles as role, i (role.name)}
          <div
            class="flex items-center gap-4 border-b border-slate-700 py-4 sm:gap-6"
          >
            <span class="font-mono text-xs text-blue-400">0{i + 1}</span>
            <span class="w-28 shrink-0 font-bold">{role.name}</span>
            <span class="text-sm text-slate-300">{role.description}</span>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
    <div class="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
      <div>
        <SectionLabel text="Good to know" />
        <h2
          class="mt-5 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
        >
          A few answers before you start.
        </h2>
      </div>
      <div
        class="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-700 dark:border-slate-700"
      >
        <details class="faq-item group py-5">
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-950 dark:text-white"
            >Does everyone need an account? <span
              aria-hidden="true"
              class="text-xl text-blue-600 group-open:rotate-45 dark:text-blue-400"
              >+</span
            ></summary
          >
          <p
            class="mt-3 max-w-2xl leading-relaxed text-slate-600 dark:text-slate-400"
          >
            Yes, team members need to sign in to create or join a team.
            Individual counters may also be shared outside a team, depending on
            their visibility and share settings.
          </p>
        </details>
        <details class="faq-item group py-5">
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-950 dark:text-white"
            >Can I move existing counters and dashboards into a team? <span
              aria-hidden="true"
              class="text-xl text-blue-600 group-open:rotate-45 dark:text-blue-400"
              >+</span
            ></summary
          >
          <p
            class="mt-3 max-w-2xl leading-relaxed text-slate-600 dark:text-slate-400"
          >
            Yes. You can move resources you personally own into a team where
            you're an editor or higher. Moving a dashboard does not
            automatically move every counter on it.
          </p>
        </details>
        <details class="faq-item group py-5">
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-950 dark:text-white"
            >How many people can join a team? <span
              aria-hidden="true"
              class="text-xl text-blue-600 group-open:rotate-45 dark:text-blue-400"
              >+</span
            ></summary
          >
          <p
            class="mt-3 max-w-2xl leading-relaxed text-slate-600 dark:text-slate-400"
          >
            A team can have up to 100 members, including its owners.
          </p>
        </details>
        <details class="faq-item group py-5">
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-950 dark:text-white"
            >How is a team different from sharing one counter? <span
              aria-hidden="true"
              class="text-xl text-blue-600 group-open:rotate-45 dark:text-blue-400"
              >+</span
            ></summary
          >
          <p
            class="mt-3 max-w-2xl leading-relaxed text-slate-600 dark:text-slate-400"
          >
            A counter link shares an individual count. A team brings people,
            counters, and dashboards together, with team roles applying across
            the resources it owns.
          </p>
        </details>
      </div>
    </div>
  </section>

  <CallToAction
    label="Your team / your counts"
    heading="Good work adds up. Count it together."
    description="Bring the people and numbers behind your work into one shared space."
    actionLabel="Create a team"
    actionHref={createTeamHref}
  />
</div>

<style>
  .workspace-wrap {
    position: relative;
    max-width: 610px;
    width: 100%;
    margin-inline: auto;
    container-type: inline-size;
  }
  .workspace-note,
  .workspace-caption {
    font:
      700 0.65rem/1.4 ui-monospace,
      monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
  }
  .workspace-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .workspace-note span {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: #10b981;
  }
  .workspace {
    color: #0f172a;
    background: #f8fafc;
    border: 1px solid #dbe3ef;
    border-radius: 12px;
    box-shadow: 0 24px 70px -24px rgb(15 23 42 / 0.3);
    overflow: hidden;
  }
  .workspace-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.5rem 1.25rem 1rem;
  }
  .workspace-name {
    font-size: 1.05rem;
    font-weight: 800;
  }
  .workspace-description {
    margin-top: 0.15rem;
    color: #64748b;
    font-size: 0.7rem;
  }
  .workspace-meta {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-top: 0.45rem;
    color: #94a3b8;
    font-size: 0.6rem;
  }
  .workspace-meta span {
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    background: #dbeafe;
    color: #1d4ed8;
  }
  .workspace-actions {
    display: flex;
    gap: 0.35rem;
  }
  .workspace-actions span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.4rem 0.55rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #fff;
    font-size: 0.65rem;
    white-space: nowrap;
  }
  .workspace-actions span:last-child {
    border-color: #fca5a5;
    color: #dc2626;
  }
  .workspace-tabs {
    display: flex;
    gap: 0.5rem;
    margin: 0 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    color: #475569;
    font-size: 0.72rem;
    font-weight: 600;
  }
  .workspace-tab {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.75rem 0.45rem;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .workspace-tab span {
    padding: 0.1rem 0.35rem;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 0.6rem;
  }
  .workspace-tab-active {
    border-color: #2563eb;
    color: #2563eb;
  }
  .workspace-content {
    padding: 1.2rem 1.25rem 1.5rem;
  }
  .workspace-toolbar {
    display: flex;
    justify-content: flex-end;
  }
  .workspace-toolbar span {
    padding: 0.4rem 0.65rem;
    border-radius: 6px;
    background: #2563eb;
    color: white;
    font-size: 0.65rem;
    font-weight: 600;
  }
  .workspace-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
    margin-top: 0.8rem;
  }
  .workspace-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 6.5rem;
    padding: 0.85rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: white;
  }
  .workspace-card span {
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.3;
  }
  .workspace-card strong {
    color: #2563eb;
    font-size: 1.6rem;
    line-height: 1.2;
  }
  .workspace-card small {
    margin-top: 0.3rem;
    color: #64748b;
    font-size: 0.65rem;
  }
  .workspace-caption {
    margin-top: 0.8rem;
    text-align: right;
  }
  .workspace-caption span {
    color: #2563eb;
  }
  .faq-item summary::-webkit-details-marker {
    display: none;
  }
  @container (max-width: 440px) {
    .workspace-top {
      flex-wrap: wrap;
    }
    .workspace-tabs {
      gap: 0;
    }
    .workspace-tab {
      gap: 0.2rem;
      padding-inline: 0.3rem;
      font-size: 0.65rem;
    }
    .workspace-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
