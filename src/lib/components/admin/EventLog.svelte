<script lang="ts">
  import { tick } from "svelte";
  import { browser } from "$app/environment";

  let {
    timeframe,
    filters = {},
    onFilterChange,
    onAggregateField,
  }: {
    timeframe: string;
    filters: Record<string, string>;
    onFilterChange: (filters: Record<string, string>) => void;
    onAggregateField: (field: string) => void;
  } = $props();

  interface EventUser {
    name: string | null;
    username: string | null;
    image: string | null;
  }

  interface PlatformEvent {
    id: number;
    eventType: string;
    userId: string | null;
    entityId: string | null;
    entityType: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    user: EventUser | null;
  }

  let events = $state<PlatformEvent[]>([]);
  let loading = $state(false);
  let page = $state(1);
  let total = $state(0);
  let totalPages = $state(0);
  let queryDurationMs = $state<number | null>(null);
  let expandedIds = $state<Set<number>>(new Set());

  const FIELD_LABELS: Record<string, string> = {
    eventType: "Event Type",
    userId: "User",
    entityId: "Entity ID",
    entityType: "Entity Type",
    counter_id: "Counter",
    counter_title: "Counter",
    dashboard_id: "Dashboard ID",
    dashboard_title: "Dashboard",
    goal_amount: "Goal Amount",
    goal_description: "Goal Description",
    user_name: "User",
    invited_email: "Invited Email",
    invited_user_id: "Invited User",
    invited_user_name: "Invited User",
    invited_username: "Invited Username",
    role: "Role",
    member_user_id: "Member User ID",
    member_username: "Member Username",
    previous_value: "Previous Value",
    new_value: "New Value",
    change: "Change",
  };

  function labelFor(key: string): string {
    return (
      FIELD_LABELS[key] ??
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  const AGGREGATABLE_FIELDS = new Set([
    "eventType",
    "userId",
    "entityId",
    "entityType",
  ]);

  function isAggregatable(key: string): boolean {
    return AGGREGATABLE_FIELDS.has(key) || true; // all metadata fields are aggregatable
  }

  // Filter search state
  let searchStep = $state<"field" | "value">("field");
  let selectedField = $state<string | null>(null);
  let fieldQuery = $state("");
  let valueQuery = $state("");
  let availableFields = $state<{ name: string; type: string }[]>([]);
  let valueSuggestions = $state<
    { value: string; label: string; filterField?: string }[]
  >([]);
  let showDropdown = $state(false);
  let loadingFields = $state(false);
  let loadingValues = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let valueInputEl: HTMLInputElement | undefined = $state();
  // Maps filter values to display labels (e.g. counter_id UUID → counter title)
  let filterDisplayLabels = $state<Record<string, string>>({});

  async function fetchFields() {
    loadingFields = true;
    try {
      const res = await fetch(
        `/api/admin/statistics/suggest?type=fields&timeframe=${timeframe}`,
      );
      if (res.ok) {
        const data = await res.json();
        availableFields = data.fields;
      }
    } finally {
      loadingFields = false;
    }
  }

  async function fetchValues(query: string) {
    if (!selectedField) return;
    loadingValues = true;
    try {
      const params = new URLSearchParams({
        type: "values",
        field: selectedField,
        timeframe,
        query,
      });
      const res = await fetch(`/api/admin/statistics/suggest?${params}`);
      if (res.ok) {
        const data = await res.json();
        valueSuggestions = data.values;
      }
    } finally {
      loadingValues = false;
    }
  }

  function debouncedFetchValues(query: string) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchValues(query), 300);
  }

  const filteredFields = $derived(
    availableFields
      .filter((f) => !(f.name in filters))
      .filter((f) => {
        if (!fieldQuery) return true;
        const label = labelFor(f.name).toLowerCase();
        const name = f.name.toLowerCase();
        const q = fieldQuery.toLowerCase();
        return label.includes(q) || name.includes(q);
      }),
  );

  async function selectField(fieldName: string) {
    if (blurTimer) clearTimeout(blurTimer);
    selectedField = fieldName;
    searchStep = "value";
    valueQuery = "";
    valueSuggestions = [];
    showDropdown = true;
    fetchValues("");
    await tick();
    requestAnimationFrame(() => {
      valueInputEl?.focus();
    });
  }

  function selectValue(
    value: string,
    filterField?: string,
    displayLabel?: string,
  ) {
    if (selectedField) {
      const key = filterField ?? selectedField;
      addFilter(key, value);
      if (displayLabel && displayLabel !== value) {
        filterDisplayLabels = { ...filterDisplayLabels, [key]: displayLabel };
      }
    }
    resetSearch();
  }

  function submitValue() {
    if (selectedField && valueQuery.trim()) {
      addFilter(selectedField, valueQuery.trim());
    }
    resetSearch();
  }

  function resetSearch() {
    searchStep = "field";
    selectedField = null;
    fieldQuery = "";
    valueQuery = "";
    valueSuggestions = [];
    showDropdown = false;
  }

  let blurTimer: ReturnType<typeof setTimeout> | undefined;

  function handleBlur() {
    blurTimer = setTimeout(() => (showDropdown = false), 150);
  }

  async function fetchEvents() {
    loading = true;
    try {
      const params = new URLSearchParams({
        timeframe,
        page: String(page),
      });
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(`filter.${key}`, value);
      }
      const res = await fetch(`/api/admin/statistics/events?${params}`);
      if (!res.ok) {
        events = [];
        total = 0;
        totalPages = 0;
        queryDurationMs = null;
        return;
      }
      const data = await res.json();
      events = data.events;
      total = data.total;
      totalPages = data.totalPages;
      queryDurationMs = data.queryDurationMs ?? null;
    } finally {
      loading = false;
    }
  }

  function toggleExpanded(id: number) {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expandedIds = next;
  }

  function addFilter(key: string, value: string) {
    onFilterChange({ ...filters, [key]: value });
  }

  /** Maps display-oriented fields to their ID equivalents for filtering */
  function addMetadataFilter(
    key: string,
    value: string,
    metadata: Record<string, unknown>,
  ) {
    // counter_title → filter by counter_id for precision
    if (key === "counter_title" && metadata.counter_id) {
      const cid = String(metadata.counter_id);
      addFilter("counter_id", cid);
      filterDisplayLabels = { ...filterDisplayLabels, counter_id: value };
      return;
    }
    // invited_user_name → filter by invited_user_id
    if (key === "invited_user_name" && metadata.invited_user_id) {
      const uid = String(metadata.invited_user_id);
      addFilter("invited_user_id", uid);
      filterDisplayLabels = { ...filterDisplayLabels, invited_user_id: value };
      return;
    }
    addFilter(key, value);
  }

  function removeFilter(key: string) {
    const next = { ...filters };
    delete next[key];
    onFilterChange(next);
    const { [key]: _, ...rest } = filterDisplayLabels;
    filterDisplayLabels = rest;
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
  }

  // Reset page when filters or timeframe change
  $effect(() => {
    timeframe;
    filters;
    page = 1;
  });

  $effect(() => {
    timeframe;
    page;
    filters;
    if (browser) {
      expandedIds = new Set();
      fetchEvents();
    }
  });

  $effect(() => {
    if (searchStep === "value" && selectedField) {
      debouncedFetchValues(valueQuery);
    }
  });

  $effect(() => {
    timeframe;
    if (browser) {
      fetchFields();
    }
  });
</script>

<div
  class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
>
  <div class="mb-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Event Log
      </h2>
      {#if queryDurationMs !== null}
        <span
          class="rounded-md px-2 py-0.5 text-xs font-mono tabular-nums {queryDurationMs >
          500
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            : queryDurationMs > 100
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}"
          title="Query duration"
        >
          {queryDurationMs}ms
        </span>
      {/if}
    </div>
    <span
      class="text-sm font-medium text-slate-100 dark:text-slate-100 tabular-nums bg-slate-700 dark:bg-slate-600 rounded-md px-2 py-0.5"
    >
      {total.toLocaleString()} event{total !== 1 ? "s" : ""}
    </span>
  </div>

  {#if Object.keys(filters).length > 0}
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="text-xs text-slate-400 dark:text-slate-500">Filters:</span>
      {#each Object.entries(filters) as [key, value] (key)}
        <button
          type="button"
          onclick={() => removeFilter(key)}
          class="flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/40"
        >
          <span class="text-blue-400 dark:text-blue-500">{labelFor(key)}:</span>
          <span class="max-w-[200px] truncate"
            >{filterDisplayLabels[key] ?? value}</span
          >
          <ion-icon name="close-outline" style="font-size: 12px;"></ion-icon>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Filter Search -->
  <div class="mb-4 relative">
    {#if searchStep === "field"}
      <div class="relative">
        <div
          class="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-2"
        >
          <ion-icon
            name="search-outline"
            class="shrink-0 text-slate-400"
            style="font-size: 14px;"
          ></ion-icon>
          <input
            type="text"
            bind:value={fieldQuery}
            onfocus={() => (showDropdown = true)}
            onblur={handleBlur}
            onkeydown={(e) => {
              if (e.key === "Escape") resetSearch();
              if (e.key === "Enter" && filteredFields.length > 0)
                selectField(filteredFields[0].name);
            }}
            placeholder="Add filter..."
            class="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none"
          />
        </div>
        {#if showDropdown && filteredFields.length > 0}
          <div
            class="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg"
          >
            {#each filteredFields as field (field.name)}
              <button
                type="button"
                onmousedown={() => selectField(field.name)}
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <span class="font-medium text-slate-700 dark:text-slate-300"
                  >{labelFor(field.name)}</span
                >
                <span class="text-xs text-slate-400 dark:text-slate-500"
                  >{field.name}</span
                >
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="relative">
        <div
          class="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-2"
        >
          <button
            type="button"
            onclick={() => {
              searchStep = "field";
              fieldQuery = "";
              showDropdown = true;
            }}
            title="Change field"
            class="shrink-0 rounded bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
          >
            {labelFor(selectedField ?? "")}
          </button>
          <input
            type="text"
            bind:value={valueQuery}
            bind:this={valueInputEl}
            onfocus={() => (showDropdown = true)}
            onblur={handleBlur}
            onkeydown={(e) => {
              if (e.key === "Escape") resetSearch();
              if (e.key === "Enter") submitValue();
            }}
            placeholder="Type a value..."
            class="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onclick={resetSearch}
            title="Cancel filter"
            class="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <ion-icon name="close-outline" style="font-size: 14px;"></ion-icon>
          </button>
        </div>
        {#if showDropdown && valueSuggestions.length > 0}
          <div
            class="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg"
          >
            {#each valueSuggestions as suggestion (suggestion.value)}
              <button
                type="button"
                onmousedown={() =>
                  selectValue(
                    suggestion.value,
                    suggestion.filterField,
                    suggestion.label,
                  )}
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <span class="text-slate-700 dark:text-slate-300"
                  >{suggestion.label}</span
                >
                {#if suggestion.label !== suggestion.value}
                  <span
                    class="text-xs text-slate-400 dark:text-slate-500 font-mono"
                    >{suggestion.value.slice(0, 12)}{suggestion.value.length >
                    12
                      ? "…"
                      : ""}</span
                  >
                {/if}
              </button>
            {/each}
          </div>
        {:else if showDropdown && loadingValues}
          <div
            class="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-3 flex items-center justify-center"
          >
            <div
              class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
            ></div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div
        class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
      ></div>
    </div>
  {:else if events.length === 0}
    <div
      class="flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 py-12"
    >
      <p class="text-sm text-slate-400 dark:text-slate-500">No events found</p>
    </div>
  {:else}
    <div class="divide-y divide-slate-100 dark:divide-slate-700">
      {#each events as event (event.id)}
        {@const isExpanded = expandedIds.has(event.id)}
        <div>
          <button
            type="button"
            onclick={() => toggleExpanded(event.id)}
            class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <ion-icon
              name={isExpanded
                ? "chevron-down-outline"
                : "chevron-forward-outline"}
              class="shrink-0 text-slate-400"
              style="font-size: 14px;"
            ></ion-icon>
            <span
              class="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-300"
            >
              <span
                class="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-500 dark:text-slate-400"
              >
                {event.eventType}
              </span>
              {#if event.metadata}
                {@const title =
                  event.metadata.counter_title ??
                  event.metadata.dashboard_title ??
                  event.metadata.goal_description ??
                  null}
                {#if title}
                  <span class="font-medium text-slate-900 dark:text-slate-100"
                    >{title}</span
                  >
                {/if}
              {/if}
              {#if event.user?.username}
                <span class="text-slate-400 dark:text-slate-500">–</span>
                <span class="text-slate-500 dark:text-slate-400"
                  >{event.user.username}</span
                >
              {:else if event.userId}
                <span class="text-slate-400 dark:text-slate-500">–</span>
                <span
                  class="font-mono text-xs text-slate-500 dark:text-slate-400"
                  >{event.userId.slice(0, 8)}…</span
                >
              {/if}
            </span>
            <span
              class="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500"
            >
              {formatDate(event.createdAt)}
            </span>
          </button>

          {#if isExpanded}
            <div
              class="ml-8 mr-3 mb-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3"
            >
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt
                  class="flex items-center gap-1 text-slate-400 dark:text-slate-500"
                >
                  Event Type
                  <button
                    type="button"
                    onclick={() => onAggregateField("eventType")}
                    title="Aggregate by Event Type"
                    class="rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                  >
                    <ion-icon name="bar-chart-outline" style="font-size: 12px;"
                    ></ion-icon>
                  </button>
                </dt>
                <dd
                  class="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                >
                  {event.eventType}
                  <button
                    type="button"
                    onclick={() => addFilter("eventType", event.eventType)}
                    class="rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                    title="Filter by Event Type: {event.eventType}"
                  >
                    <ion-icon name="search-outline" style="font-size: 12px;"
                    ></ion-icon>
                  </button>
                </dd>

                {#if event.userId}
                  <dt
                    class="flex items-center gap-1 text-slate-400 dark:text-slate-500"
                  >
                    User
                    <button
                      type="button"
                      onclick={() => onAggregateField("userId")}
                      title="Aggregate by User"
                      class="rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                    >
                      <ion-icon
                        name="bar-chart-outline"
                        style="font-size: 12px;"
                      ></ion-icon>
                    </button>
                  </dt>
                  <dd
                    class="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                  >
                    <a
                      href="/admin/users/{event.userId}"
                      class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                      title="View user details"
                    >
                      {event.user?.username || event.userId}
                    </a>
                    <button
                      type="button"
                      onclick={() => addFilter("userId", event.userId ?? "")}
                      class="rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                      title="Filter by this user"
                    >
                      <ion-icon name="search-outline" style="font-size: 12px;"
                      ></ion-icon>
                    </button>
                  </dd>
                {/if}

                {#if event.entityId}
                  <dt
                    class="flex items-center gap-1 text-slate-400 dark:text-slate-500"
                  >
                    Entity ID
                    <button
                      type="button"
                      onclick={() => onAggregateField("entityId")}
                      title="Aggregate by Entity ID"
                      class="rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                    >
                      <ion-icon
                        name="bar-chart-outline"
                        style="font-size: 12px;"
                      ></ion-icon>
                    </button>
                  </dt>
                  <dd
                    class="flex items-center gap-1.5 font-mono text-xs text-slate-700 dark:text-slate-300"
                  >
                    {#if event.entityType === "counter" || event.entityType === "invitation"}
                      <a
                        href="/c/{event.entityId}"
                        class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                        title="Open counter"
                      >
                        {event.entityId}
                      </a>
                    {:else}
                      {event.entityId}
                    {/if}
                    <button
                      type="button"
                      onclick={() =>
                        addFilter("entityId", event.entityId ?? "")}
                      class="rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                      title="Filter by this entity"
                    >
                      <ion-icon name="search-outline" style="font-size: 12px;"
                      ></ion-icon>
                    </button>
                  </dd>
                {/if}

                {#if event.entityType}
                  <dt
                    class="flex items-center gap-1 text-slate-400 dark:text-slate-500"
                  >
                    Entity Type
                    <button
                      type="button"
                      onclick={() => onAggregateField("entityType")}
                      title="Aggregate by Entity Type"
                      class="rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                    >
                      <ion-icon
                        name="bar-chart-outline"
                        style="font-size: 12px;"
                      ></ion-icon>
                    </button>
                  </dt>
                  <dd
                    class="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                  >
                    {event.entityType}
                    <button
                      type="button"
                      onclick={() =>
                        addFilter("entityType", event.entityType ?? "")}
                      class="rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                      title="Filter by this type"
                    >
                      <ion-icon name="search-outline" style="font-size: 12px;"
                      ></ion-icon>
                    </button>
                  </dd>
                {/if}

                <dt class="text-slate-400 dark:text-slate-500">Timestamp</dt>
                <dd class="text-slate-700 dark:text-slate-300">
                  {formatDate(event.createdAt)}
                </dd>

                {#if event.metadata && Object.keys(event.metadata).length > 0}
                  {#each Object.entries(event.metadata) as [key, value] (key)}
                    {@const strValue = String(value ?? "")}
                    {#if strValue && !(key === "invited_user_id" && event.metadata?.invited_user_name)}
                      <dt
                        class="flex items-center gap-1 text-slate-400 dark:text-slate-500"
                      >
                        {labelFor(key)}
                        <button
                          type="button"
                          onclick={() => onAggregateField(key)}
                          title="Aggregate by {labelFor(key)}"
                          class="rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                        >
                          <ion-icon
                            name="bar-chart-outline"
                            style="font-size: 12px;"
                          ></ion-icon>
                        </button>
                      </dt>
                      <dd
                        class="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                      >
                        {#if key === "counter_id"}
                          <a
                            href="/c/{strValue}"
                            class="min-w-0 truncate font-mono text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                            title="Open counter"
                          >
                            {strValue}
                          </a>
                        {:else if key === "invited_user_id" || key === "member_user_id"}
                          <a
                            href="/admin/users/{strValue}"
                            class="min-w-0 truncate font-mono text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                            title="View user details"
                          >
                            {strValue}
                          </a>
                        {:else if key === "invited_user_name"}
                          <a
                            href="/admin/users/{event.metadata
                              ?.invited_user_id ?? ''}"
                            class="min-w-0 truncate text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                            title="View user details"
                          >
                            {strValue}
                          </a>
                        {:else}
                          <span class="min-w-0 truncate">{strValue}</span>
                        {/if}
                        <button
                          type="button"
                          onclick={() =>
                            addMetadataFilter(
                              key,
                              strValue,
                              event.metadata ?? {},
                            )}
                          class="shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400"
                          title="Filter by {labelFor(key)}: {strValue}"
                        >
                          <ion-icon
                            name="search-outline"
                            style="font-size: 12px;"
                          ></ion-icon>
                        </button>
                      </dd>
                    {/if}
                  {/each}
                {/if}
              </dl>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if totalPages > 1}
      {@const pageItems = (() => {
        const items: (number | "...")[] = [];
        if (totalPages <= 7) {
          for (let i = 1; i <= totalPages; i++) items.push(i);
        } else {
          items.push(1);
          if (page > 3) items.push("...");
          const start = Math.max(2, page - 1);
          const end = Math.min(totalPages - 1, page + 1);
          for (let i = start; i <= end; i++) items.push(i);
          if (page < totalPages - 2) items.push("...");
          items.push(totalPages);
        }
        return items;
      })()}
      <nav
        aria-label="Event log pagination"
        class="mt-4 flex items-center justify-center gap-1 border-t border-slate-100 dark:border-slate-700 pt-4"
      >
        <button
          type="button"
          disabled={page <= 1}
          onclick={() => (page = page - 1)}
          class="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          &larr; Prev
        </button>

        {#each pageItems as item}
          {#if item === "..."}
            <span class="px-2 py-1.5 text-sm text-slate-400 dark:text-slate-500"
              >&hellip;</span
            >
          {:else if item === page}
            <span
              class="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white font-medium"
            >
              {item}
            </span>
          {:else}
            <button
              type="button"
              onclick={() => (page = item)}
              class="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {item}
            </button>
          {/if}
        {/each}

        <button
          type="button"
          disabled={page >= totalPages}
          onclick={() => (page = page + 1)}
          class="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next &rarr;
        </button>
      </nav>
    {/if}
  {/if}
</div>
