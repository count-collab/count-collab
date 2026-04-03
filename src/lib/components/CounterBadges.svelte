<script lang="ts">
  import type { CounterVisibilityMode } from "$lib/db/schema";

  type BadgeOwnership = "owner" | "shared" | null;

  type Props = {
    visibilityMode: CounterVisibilityMode;
    ownership?: BadgeOwnership;
    containerClass?: string;
    visibilityBadgeBaseClass?: string;
    visibilityLabels?: Record<CounterVisibilityMode, string>;
    visibilityBadgeClasses?: Record<CounterVisibilityMode, string>;
    ownerBadgeClass?: string;
    sharedBadgeClass?: string;
  };

  const {
    visibilityMode,
    ownership = null,
    containerClass = "flex flex-wrap items-center gap-2",
    visibilityBadgeBaseClass = "text-xs px-2 py-0.5 rounded-full",
    visibilityLabels = {
      public: "Public",
      public_readonly: "Public",
      private: "Private",
    },
    visibilityBadgeClasses = {
      public: "bg-emerald-100 text-emerald-700",
      public_readonly: "bg-amber-100 text-amber-700",
      private: "bg-slate-100 text-slate-600",
    },
    ownerBadgeClass = "text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700",
    sharedBadgeClass = "text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700",
  }: Props = $props();

  const getVisibilityClass = (mode: CounterVisibilityMode) =>
    [visibilityBadgeBaseClass, visibilityBadgeClasses[mode]].join(" ");
</script>

<div class={containerClass}>
  {#if visibilityMode === "public_readonly"}
    <span class={getVisibilityClass("public")}>
      {visibilityLabels.public}
    </span>
    <span class={getVisibilityClass("public_readonly")}>
      read-only
    </span>
  {:else}
    <span class={getVisibilityClass(visibilityMode)}>
      {visibilityLabels[visibilityMode]}
    </span>
  {/if}

  {#if ownership === "owner"}
    <span class={ownerBadgeClass}>Owner</span>
  {:else if ownership === "shared"}
    <span class={sharedBadgeClass}>Shared</span>
  {/if}
</div>