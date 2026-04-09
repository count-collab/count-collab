<script lang="ts">
  import { browser } from "$app/environment";
  import { goto, invalidate } from "$app/navigation";
  import AddCounterModal from "$lib/components/AddCounterModal.svelte";
  import MetaTags from "$lib/components/MetaTags.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import RollingNumber from "$lib/components/RollingNumber.svelte";
  import type {
    DashboardMemberRole,
    DashboardVisibilityMode,
  } from "$lib/db/schema";
  import { onCounterUpdated } from "$lib/stores/counters";
  import {
    onDashboardItemAdded,
    onDashboardItemRemoved,
    onDashboardUpdated,
  } from "$lib/stores/dashboards";
  import { rateLimit } from "$lib/stores/ratelimit";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  const visibilityLabels: Record<DashboardVisibilityMode, string> = {
    public: "Public",
    private: "Private",
  };
  const visibilityDescriptions: Record<DashboardVisibilityMode, string> = {
    public: "Anyone with the link can view.",
    private:
      "Only invited members or people with the private link can access it.",
  };
  const visibilityBadgeClasses: Record<DashboardVisibilityMode, string> = {
    public:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    private:
      "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };
  const memberRoleLabels: Record<DashboardMemberRole, string> = {
    viewer: "Viewer",
    editor: "Editor",
    admin: "Admin",
  };

  function getRoleLabel(role: string): string {
    return memberRoleLabels[role as DashboardMemberRole] ?? role;
  }

  const visibilityMode = $derived(
    data.dashboard.visibilityMode as DashboardVisibilityMode,
  );

  // Optimistic counts per counter
  let optimisticCounts = $state<Record<string, number>>({});
  let errorMessage = $state<string | null>(null);
  let incrementingCounters = $state<Record<string, boolean>>({});

  // Edit modal state
  let showEditModal = $state(false);
  let editTitle = $state("");
  let editDescription = $state("");
  let editVisibility = $state<DashboardVisibilityMode>("public");
  let editError = $state<string | null>(null);
  let isSaving = $state(false);

  // Delete confirmation state
  let showDeleteConfirm = $state(false);
  let isDeleting = $state(false);

  // Share modal state
  let showShareModal = $state(false);
  let copySuccess = $state(false);

  // Actions dropdown state
  let showActionsMenu = $state(false);

  // Edit mode (drag & drop)
  let editMode = $state(false);
  let draggedItemId = $state<number | null>(null);
  let dragDropTarget = $state<{ x: number; y: number } | null>(null);
  let hoveredEmptyCell = $state<{ x: number; y: number } | null>(null);

  // Add counter modal
  let showAddCounterModal = $state(false);
  let addCounterTargetCell = $state<{ x: number; y: number } | null>(null);

  // Member invitation state
  let inviteUsername = $state("");
  let inviteRole = $state<DashboardMemberRole>("viewer");
  let inviteError = $state<string | null>(null);
  let inviteSuccess = $state<string | null>(null);
  let isInviting = $state(false);

  // Grid dimensions
  const GRID_COLS = 5;

  const draggedItem = $derived(
    draggedItemId !== null
      ? (data.items.find((i) => i.item.id === draggedItemId)?.item ?? null)
      : null,
  );

  const dragPreviewPosition = $derived.by(() => {
    if (!draggedItem || !dragDropTarget) return null;
    const w = draggedItem.sizeColumns;
    const h = draggedItem.sizeRows;
    const clampedX = Math.min(Math.max(0, dragDropTarget.x), GRID_COLS - w);
    const clampedY = Math.max(0, dragDropTarget.y);
    return { x: clampedX, y: clampedY, w, h };
  });

  // Follow/unfollow state
  let isFollowing = $state(false);

  const canFollow = $derived(
    !!data.session?.user?.id &&
      !data.isOwner &&
      !data.canEdit &&
      !data.canManage &&
      data.dashboard.visibilityMode !== "private",
  );
  const isViewer = $derived(data.memberRole === "viewer");

  async function handleFollow() {
    if (isFollowing) return;
    isFollowing = true;

    try {
      const response = await fetch(
        `/api/dashboards/${data.dashboard.id}/follow`,
        {
          method: "POST",
        },
      );
      if (response.ok) {
        await invalidate(`dashboard:${data.dashboard.id}`);
      } else {
        const body = await response.json();
        errorMessage = body.message ?? "Failed to follow dashboard.";
      }
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      isFollowing = false;
    }
  }

  async function handleUnfollow() {
    if (isFollowing) return;
    isFollowing = true;

    try {
      const response = await fetch(
        `/api/dashboards/${data.dashboard.id}/follow`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) {
        await invalidate(`dashboard:${data.dashboard.id}`);
      } else {
        const body = await response.json();
        errorMessage = body.message ?? "Failed to unfollow dashboard.";
      }
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      isFollowing = false;
    }
  }
  const gridRows = $derived.by(() => {
    let maxRow = 0;
    for (const { item } of data.items) {
      const bottom = item.positionY + item.sizeRows;
      if (bottom > maxRow) maxRow = bottom;
    }
    return Math.max(maxRow, 1);
  });

  const occupiedCells = $derived.by(() => {
    const cells = new Set<string>();
    for (const { item } of data.items) {
      for (let dx = 0; dx < item.sizeColumns; dx++) {
        for (let dy = 0; dy < item.sizeRows; dy++) {
          cells.add(`${item.positionX + dx},${item.positionY + dy}`);
        }
      }
    }
    return cells;
  });

  const emptyCells = $derived.by(() => {
    // When dragging, treat the dragged item's cells as empty
    const draggedCells = new Set<string>();
    if (draggedItem) {
      for (let dx = 0; dx < draggedItem.sizeColumns; dx++) {
        for (let dy = 0; dy < draggedItem.sizeRows; dy++) {
          draggedCells.add(
            `${draggedItem.positionX + dx},${draggedItem.positionY + dy}`,
          );
        }
      }
    }
    const cells: Array<{ x: number; y: number }> = [];
    const rows = Math.max(gridRows + 1, 2);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const key = `${x},${y}`;
        if (!occupiedCells.has(key) || draggedCells.has(key)) {
          cells.push({ x, y });
        }
      }
    }
    return cells;
  });

  const existingCounterIds = $derived(
    data.items.filter((i) => i.counter).map((i) => i.item.counterId),
  );

  const shareUrl = $derived.by(() => {
    const base = browser
      ? `${window.location.origin}/d/${data.dashboard.id}`
      : `/d/${data.dashboard.id}`;
    if (visibilityMode === "private" && data.shareToken) {
      return `${base}?token=${data.shareToken}`;
    }
    return base;
  });

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copySuccess = true;
      setTimeout(() => (copySuccess = false), 2000);
    } catch {
      // fallback
    }
  }

  function getDisplayCount(counterId: string, serverCount: number): number {
    return optimisticCounts[counterId] ?? serverCount;
  }

  async function handleCounterChange(
    counterId: string,
    currentCount: number,
    delta: number,
  ) {
    if (incrementingCounters[counterId]) return;

    if ($rateLimit.isLimited) {
      errorMessage = `Please wait ${$rateLimit.retryAfterSeconds}s before updating again.`;
      return;
    }

    incrementingCounters[counterId] = true;
    errorMessage = null;
    optimisticCounts[counterId] = currentCount + delta;

    try {
      const fetchOptions: RequestInit = { method: "POST" };
      if (delta !== 1) {
        fetchOptions.headers = { "Content-Type": "application/json" };
        fetchOptions.body = JSON.stringify({ amount: delta });
      }

      const response = await fetch(`/api/counters/${counterId}`, fetchOptions);

      if (!response.ok) {
        const body = await response.json();
        optimisticCounts[counterId] = currentCount;

        if (response.status === 429) {
          const retryAfter = body.retryAfterSeconds ?? 5;
          rateLimit.setLimit(`/api/counters/${counterId}`, retryAfter);
          errorMessage = `Please wait ${retryAfter}s before updating again.`;
          return;
        }

        errorMessage = body.error ?? "Failed to update counter.";
        return;
      }

      const result: {
        count: number;
        updatedAt: string;
        cooldownSeconds: number;
      } = await response.json();
      optimisticCounts[counterId] = result.count;
      if (result.cooldownSeconds > 0) {
        rateLimit.setLimit(
          `/api/counters/${counterId}`,
          result.cooldownSeconds,
        );
      }
      await invalidate(`dashboard:${data.dashboard.id}`);
      delete optimisticCounts[counterId];
    } catch {
      optimisticCounts[counterId] = currentCount;
      errorMessage = "Network error. Please try again.";
    } finally {
      incrementingCounters[counterId] = false;
    }
  }

  async function handleSaveEdit() {
    if (isSaving) return;
    isSaving = true;
    editError = null;

    try {
      const response = await fetch(`/api/dashboards/${data.dashboard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          visibility: editVisibility,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        editError = body.error ?? "Failed to update dashboard.";
        return;
      }

      showEditModal = false;
      invalidate(`dashboard:${data.dashboard.id}`);
    } catch {
      editError = "Network error. Please try again.";
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete() {
    if (isDeleting) return;
    isDeleting = true;

    try {
      const response = await fetch(`/api/dashboards/${data.dashboard.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json();
        errorMessage = body.error ?? "Failed to delete dashboard.";
        showDeleteConfirm = false;
        return;
      }

      await goto("/");
    } catch {
      errorMessage = "Network error. Please try again.";
    } finally {
      isDeleting = false;
      showDeleteConfirm = false;
    }
  }

  async function handleInvite() {
    if (isInviting || !inviteUsername.trim()) return;
    isInviting = true;
    inviteError = null;
    inviteSuccess = null;

    try {
      const response = await fetch(`/d/${data.dashboard.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inviteUsername, role: inviteRole }),
      });

      if (!response.ok) {
        const body = await response.json();
        inviteError = body.error ?? "Failed to invite user.";
        return;
      }

      inviteSuccess = `Invited ${inviteUsername} as ${getRoleLabel(inviteRole)}`;
      inviteUsername = "";
      invalidate(`dashboard:${data.dashboard.id}`);
    } catch {
      inviteError = "Network error. Please try again.";
    } finally {
      isInviting = false;
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const response = await fetch(
        `/d/${data.dashboard.id}/members/${userId}`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) {
        invalidate(`dashboard:${data.dashboard.id}`);
      }
    } catch {
      // silently fail
    }
  }

  async function handleMove(
    itemId: number,
    positionX: number,
    positionY: number,
  ) {
    await fetch(`/api/dashboards/${data.dashboard.id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", itemId, positionX, positionY }),
    });
    await invalidate(`dashboard:${data.dashboard.id}`);
  }

  async function handleResize(
    itemId: number,
    sizeColumns: number,
    sizeRows: number,
  ) {
    await fetch(`/api/dashboards/${data.dashboard.id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resize", itemId, sizeColumns, sizeRows }),
    });
    await invalidate(`dashboard:${data.dashboard.id}`);
  }

  async function handleRemoveItem(itemId: number) {
    await fetch(`/api/dashboards/${data.dashboard.id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    await invalidate(`dashboard:${data.dashboard.id}`);
  }

  async function handleAddCounter(counterId: string) {
    let posX = 0;
    let posY = 0;

    if (addCounterTargetCell) {
      posX = addCounterTargetCell.x;
      posY = addCounterTargetCell.y;
      addCounterTargetCell = null;
    } else {
      // Fallback: find the earliest free cell, accounting for multi-cell items
      outer: for (let y = 0; y <= gridRows + 1; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
          if (!occupiedCells.has(`${x},${y}`)) {
            posX = x;
            posY = y;
            break outer;
          }
        }
      }
    }

    const response = await fetch(`/api/dashboards/${data.dashboard.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counterId,
        positionX: posX,
        positionY: posY,
        sizeColumns: 1,
        sizeRows: 1,
      }),
    });
    if (response.ok) {
      await invalidate(`dashboard:${data.dashboard.id}`);
    }
  }

  // Real-time counter updates
  $effect(() => {
    if (!browser) return;

    const unsubscribe = onCounterUpdated((payload) => {
      const hasCounter = data.items.some(
        (i: { counter: { id: string } | null }) =>
          i.counter?.id === payload.counterId,
      );
      if (!hasCounter) return;
      if (incrementingCounters[payload.counterId]) return;

      invalidate(`dashboard:${data.dashboard.id}`).then(() => {
        delete optimisticCounts[payload.counterId];
      });
    });

    return unsubscribe;
  });

  // Real-time dashboard updates
  $effect(() => {
    if (!browser) return;

    const unsubs = [
      onDashboardUpdated((payload) => {
        if (payload.dashboardId !== data.dashboard.id) return;
        invalidate(`dashboard:${data.dashboard.id}`);
      }),
      onDashboardItemAdded((payload) => {
        if (payload.dashboardId !== data.dashboard.id) return;
        invalidate(`dashboard:${data.dashboard.id}`);
      }),
      onDashboardItemRemoved((payload) => {
        if (payload.dashboardId !== data.dashboard.id) return;
        invalidate(`dashboard:${data.dashboard.id}`);
      }),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  });

  $effect(() => {
    if (!$rateLimit.isLimited && errorMessage) {
      errorMessage = null;
    }
  });
</script>

<MetaTags
  title={data.title}
  description={data.description}
  path="/d/{data.dashboard.id}"
/>

<div class="flex flex-col min-h-[calc(100vh-8rem)]">
  <!-- Header -->
  <header class="pb-6">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <h1
          class="text-xl font-bold text-slate-900 dark:text-slate-100 break-words"
        >
          {data.dashboard.title}
        </h1>
        {#if data.dashboard.description}
          <p
            class="text-sm text-slate-500 dark:text-slate-400 mt-0.5 break-words"
          >
            {data.dashboard.description}
          </p>
        {/if}
      </div>

      <!-- Desktop action buttons -->
      <div class="hidden sm:flex gap-2 shrink-0 ml-4">
        {#if canFollow}
          {#if isViewer}
            <button
              type="button"
              onclick={handleUnfollow}
              disabled={isFollowing}
              class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5 dark:border-slate-600 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              Unfollow
            </button>
          {:else}
            <button
              type="button"
              onclick={handleFollow}
              disabled={isFollowing}
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              Follow
            </button>
          {/if}
        {/if}
        {#if data.canManage}
          <button
            type="button"
            onclick={() => (showShareModal = true)}
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            <ion-icon name="share-social-outline" style="font-size: 16px;"
            ></ion-icon>
            Share
          </button>
        {/if}
        {#if data.canEdit}
          <button
            type="button"
            onclick={() => (editMode = !editMode)}
            class="px-3 py-1.5 text-sm border rounded-lg transition inline-flex items-center gap-1.5 {editMode
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
              : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'}"
          >
            <ion-icon
              name={editMode ? "checkmark-outline" : "grid-outline"}
              style="font-size: 16px;"
            ></ion-icon>
            {editMode ? "Done" : "Edit Layout"}
          </button>

          <button
            type="button"
            onclick={() => {
              editTitle = data.dashboard.title;
              editDescription = data.dashboard.description ?? "";
              editVisibility = visibilityMode;
              showEditModal = true;
            }}
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            <ion-icon name="create-outline" style="font-size: 16px;"></ion-icon>
            Edit
          </button>
        {/if}
        {#if data.canDelete}
          <button
            type="button"
            onclick={() => (showDeleteConfirm = true)}
            class="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition inline-flex items-center gap-1.5 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <ion-icon name="trash-outline" style="font-size: 16px;"></ion-icon>
            Delete
          </button>
        {/if}
      </div>

      <!-- Mobile actions dropdown -->
      {#if data.canManage || data.canEdit || data.canDelete || canFollow}
        <div class="relative sm:hidden shrink-0">
          <button
            type="button"
            onclick={() => (showActionsMenu = !showActionsMenu)}
            class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 transition dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Dashboard actions"
          >
            <ion-icon name="ellipsis-vertical" style="font-size: 20px;"
            ></ion-icon>
          </button>
          {#if showActionsMenu}
            <button
              type="button"
              class="fixed inset-0 z-40"
              aria-label="Close menu"
              onclick={() => (showActionsMenu = false)}
            ></button>
            <div
              class="absolute right-0 top-full mt-1 z-50 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 dark:bg-slate-800 dark:shadow-slate-900/50 dark:border-slate-700"
            >
              {#if canFollow}
                {#if isViewer}
                  <button
                    type="button"
                    onclick={() => {
                      showActionsMenu = false;
                      handleUnfollow();
                    }}
                    disabled={isFollowing}
                    class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Unfollow
                  </button>
                {:else}
                  <button
                    type="button"
                    onclick={() => {
                      showActionsMenu = false;
                      handleFollow();
                    }}
                    disabled={isFollowing}
                    class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Follow
                  </button>
                {/if}
              {/if}
              {#if data.canManage}
                <button
                  type="button"
                  onclick={() => {
                    showActionsMenu = false;
                    showShareModal = true;
                  }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <ion-icon name="share-social-outline" style="font-size: 16px;"
                  ></ion-icon>
                  Share
                </button>
              {/if}
              {#if data.canEdit}
                <button
                  type="button"
                  onclick={() => {
                    showActionsMenu = false;
                    editMode = !editMode;
                  }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <ion-icon
                    name={editMode ? "checkmark-outline" : "grid-outline"}
                    style="font-size: 16px;"
                  ></ion-icon>
                  {editMode ? "Done" : "Edit Layout"}
                </button>
                {#if editMode}
                  <button
                    type="button"
                    onclick={() => {
                      showActionsMenu = false;
                      showAddCounterModal = true;
                    }}
                    class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <ion-icon name="add-outline" style="font-size: 16px;"
                    ></ion-icon>
                    Add Counter
                  </button>
                {/if}
                <button
                  type="button"
                  onclick={() => {
                    showActionsMenu = false;
                    editTitle = data.dashboard.title;
                    editDescription = data.dashboard.description ?? "";
                    editVisibility = visibilityMode;
                    showEditModal = true;
                  }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <ion-icon name="create-outline" style="font-size: 16px;"
                  ></ion-icon>
                  Edit
                </button>
              {/if}
              {#if data.canDelete}
                <button
                  type="button"
                  onclick={() => {
                    showActionsMenu = false;
                    showDeleteConfirm = true;
                  }}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <ion-icon name="trash-outline" style="font-size: 16px;"
                  ></ion-icon>
                  Delete
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Tags row -->
    <div class="flex flex-wrap items-center gap-2 mt-2">
      <span
        class="text-xs px-2 py-0.5 rounded-full {visibilityBadgeClasses[
          visibilityMode
        ]}"
      >
        {visibilityLabels[visibilityMode]}
      </span>
      {#if data.isOwner}
        <span
          class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        >
          Owner
        </span>
      {/if}
      <span class="text-xs text-slate-400 dark:text-slate-500">
        Created {new Date(data.dashboard.createdAt).toLocaleDateString()}
        · Updated {new Date(data.dashboard.updatedAt).toLocaleString()}
      </span>
    </div>
  </header>

  <!-- Error message -->
  {#if errorMessage}
    <p class="mb-4 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
  {/if}

  <!-- Counter Grid -->
  {#if data.items.length > 0}
    <section
      class="grid gap-4 rounded-xl transition-all {editMode
        ? 'ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50/30 dark:bg-blue-950/10 p-4 -m-4'
        : ''}"
      style="grid-template-columns: repeat({GRID_COLS}, 1fr); grid-template-rows: repeat({editMode
        ? Math.max(gridRows + 1, 2)
        : gridRows}, minmax(140px, auto));"
    >
      {#each data.items as { item, counter, canIncrement } (item.id)}
        {@const displayCount = counter
          ? getDisplayCount(counter.id, counter.count)
          : 0}
        <div
          draggable={editMode ? "true" : undefined}
          role={editMode ? "button" : undefined}
          class="min-w-0 {editMode
            ? draggedItemId === item.id
              ? 'opacity-50 cursor-grabbing pointer-events-none'
              : 'cursor-grab'
            : ''}"
          style="grid-column: {item.positionX +
            1} / span {item.sizeColumns}; grid-row: {item.positionY +
            1} / span {item.sizeRows};"
          ondragstart={(e) => {
            if (!editMode) return;
            draggedItemId = item.id;
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
          }}
          ondragend={() => {
            draggedItemId = null;
            dragDropTarget = null;
          }}
          ondragover={(e) => {
            if (
              !editMode ||
              draggedItemId === null ||
              draggedItemId === item.id
            )
              return;
            e.preventDefault();
            dragDropTarget = { x: item.positionX, y: item.positionY };
          }}
          ondragleave={() => {
            if (
              dragDropTarget?.x === item.positionX &&
              dragDropTarget?.y === item.positionY
            )
              dragDropTarget = null;
          }}
          ondrop={(e) => {
            if (
              !editMode ||
              draggedItemId === null ||
              draggedItemId === item.id ||
              !draggedItem
            )
              return;
            e.preventDefault();
            const clampedX = Math.min(
              item.positionX,
              GRID_COLS - draggedItem.sizeColumns,
            );
            handleMove(draggedItemId, clampedX, item.positionY);
            draggedItemId = null;
            dragDropTarget = null;
          }}
        >
          {#if counter}
            <div
              class="group relative flex flex-col h-full overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-5 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg hover:ring-blue-100 dark:hover:ring-blue-900 hover:-translate-y-0.5"
            >
              <!-- Counter title -->
              <a
                href="/c/{counter.id}"
                class="relative font-semibold text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title={counter.title}
              >
                {counter.title}
              </a>

              <!-- Counter description -->
              {#if counter.description}
                <span
                  class="relative text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate"
                >
                  {counter.description}
                </span>
              {/if}

              <!-- Count display -->
              <div class="flex items-baseline mt-3">
                <span
                  class="text-4xl sm:text-5xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400 leading-none"
                >
                  <RollingNumber value={displayCount} />
                </span>
              </div>

              <!-- Increment button (right side, visible on hover) -->
              {#if !editMode && canIncrement}
                <button
                  type="button"
                  onclick={() =>
                    handleCounterChange(counter.id, displayCount, 1)}
                  disabled={incrementingCounters[counter.id] ||
                    $rateLimit.isLimited}
                  aria-label="Increment {counter.title}"
                  class="absolute right-3 top-0 bottom-0 w-14 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 hover:drop-shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ion-icon name="add-circle-outline" style="font-size: 40px;"
                  ></ion-icon>
                </button>
              {/if}

              <!-- Edit mode: resize + delete controls -->
              {#if editMode}
                <div class="flex items-center gap-2 mt-auto pt-3 justify-end">
                  <select
                    aria-label="Size of {counter.title}"
                    value="{item.sizeColumns}x{item.sizeRows}"
                    onchange={(e) => {
                      e.stopPropagation();
                      const val = (e.currentTarget as HTMLSelectElement).value;
                      const [cols, rows] = val.split("x").map(Number);
                      handleResize(item.id, cols, rows);
                    }}
                    onclick={(e) => e.stopPropagation()}
                    class="h-7 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {#each [{ cols: 1, rows: 1, label: "1×1" }, { cols: 2, rows: 1, label: "2×1" }, { cols: 3, rows: 1, label: "3×1" }, { cols: 4, rows: 1, label: "4×1" }, { cols: 5, rows: 1, label: "5×1" }, { cols: 1, rows: 2, label: "1×2" }, { cols: 2, rows: 2, label: "2×2" }, { cols: 3, rows: 2, label: "3×2" }, { cols: 4, rows: 2, label: "4×2" }, { cols: 5, rows: 2, label: "5×2" }] as opt (opt.label)}
                      <option
                        value="{opt.cols}x{opt.rows}"
                        selected={item.sizeColumns === opt.cols &&
                          item.sizeRows === opt.rows}
                      >
                        {opt.label}
                      </option>
                    {/each}
                  </select>
                  <button
                    type="button"
                    onclick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(item.id);
                    }}
                    aria-label="Remove {counter.title} from dashboard"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-slate-600 transition bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  >
                    <ion-icon name="trash-outline" style="font-size: 14px;"
                    ></ion-icon>
                  </button>
                </div>
              {/if}
            </div>
          {:else}
            <!-- Inaccessible counter placeholder -->
            <div
              class="flex flex-col items-center justify-center h-full rounded-xl border-dashed border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-4"
            >
              <ion-icon
                name="lock-closed-outline"
                style="font-size: 24px;"
                class="text-slate-400 dark:text-slate-500 mb-2"
              ></ion-icon>
              <p class="text-sm text-slate-400 dark:text-slate-500 text-center">
                Private Counter
              </p>
            </div>
          {/if}
        </div>
      {/each}
      {#if editMode}
        {#each emptyCells as cell (`empty-${cell.x}-${cell.y}`)}
          <div
            style="grid-column: {cell.x + 1}; grid-row: {cell.y + 1};"
            class="group/cell rounded-xl transition-colors min-h-[140px] hover:border-2 hover:border-dashed hover:border-slate-300 dark:hover:border-slate-600"
            onmouseenter={() => (hoveredEmptyCell = { x: cell.x, y: cell.y })}
            onmouseleave={() => {
              if (
                hoveredEmptyCell?.x === cell.x &&
                hoveredEmptyCell?.y === cell.y
              )
                hoveredEmptyCell = null;
            }}
            ondragover={(e) => {
              if (draggedItemId === null) return;
              e.preventDefault();
              dragDropTarget = { x: cell.x, y: cell.y };
            }}
            ondragleave={() => {
              if (dragDropTarget?.x === cell.x && dragDropTarget?.y === cell.y)
                dragDropTarget = null;
            }}
            ondrop={(e) => {
              if (draggedItemId === null || !draggedItem) return;
              e.preventDefault();
              const clampedX = Math.min(
                cell.x,
                GRID_COLS - draggedItem.sizeColumns,
              );
              handleMove(draggedItemId, clampedX, cell.y);
              draggedItemId = null;
              dragDropTarget = null;
            }}
            role="presentation"
          >
            <button
              type="button"
              onclick={() => {
                addCounterTargetCell = { x: cell.x, y: cell.y };
                showAddCounterModal = true;
              }}
              class="hidden group-hover/cell:flex w-full h-full items-center justify-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ion-icon name="add-outline" style="font-size: 18px;"></ion-icon>
              Add Counter
            </button>
          </div>
        {/each}
        {#if dragPreviewPosition}
          <div
            style="grid-column: {dragPreviewPosition.x +
              1} / span {dragPreviewPosition.w}; grid-row: {dragPreviewPosition.y +
              1} / span {dragPreviewPosition.h};"
            class="rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 pointer-events-none z-10"
          ></div>
        {/if}
      {/if}
    </section>
  {:else}
    <div
      class="flex-1 flex flex-col items-center justify-center py-16 text-center"
    >
      <ion-icon
        name="grid-outline"
        style="font-size: 48px;"
        class="text-slate-300 dark:text-slate-600 mb-4"
      ></ion-icon>
      <p class="text-slate-500 dark:text-slate-400 text-lg font-medium">
        No counters yet
      </p>
      <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">
        {#if data.canEdit}
          Add counters to this dashboard to get started.
        {:else}
          This dashboard doesn't have any counters yet.
        {/if}
      </p>
      {#if data.canEdit}
        <button
          type="button"
          onclick={() => {
            editMode = true;
            showAddCounterModal = true;
          }}
          class="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-1.5"
        >
          <ion-icon name="add-outline" style="font-size: 16px;"></ion-icon>
          Add Counter
        </button>
      {/if}
    </div>
  {/if}
</div>

<!-- Share Modal -->
<Modal bind:open={showShareModal} title="Share Dashboard">
  <div class="space-y-5">
    <div class="space-y-1">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
        Visibility
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="text-xs px-2 py-0.5 rounded-full {visibilityBadgeClasses[
            visibilityMode
          ]}"
        >
          {visibilityLabels[visibilityMode]}
        </span>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {visibilityDescriptions[visibilityMode]}
        </p>
      </div>
    </div>

    <!-- Shareable link -->
    <div class="space-y-1">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
        Shareable link
      </p>
      <div class="flex items-center gap-2">
        <p
          class="flex-1 text-sm text-slate-500 bg-slate-50 rounded-md px-3 py-2 font-mono select-all truncate dark:text-slate-400 dark:bg-slate-700"
        >
          {shareUrl}
        </p>
        <button
          type="button"
          onclick={copyShareLink}
          class="shrink-0 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition inline-flex items-center gap-1.5 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          {#if copySuccess}
            <ion-icon
              name="checkmark-outline"
              style="font-size: 16px;"
              class="text-green-600 dark:text-green-400"
            ></ion-icon>
            Copied
          {:else}
            <ion-icon name="copy-outline" style="font-size: 16px;"></ion-icon>
            Copy
          {/if}
        </button>
      </div>
      {#if visibilityMode === "private" && data.shareToken}
        <p class="text-xs text-amber-600 dark:text-amber-400">
          Anyone with this link can view this private dashboard.
        </p>
      {/if}
    </div>

    <!-- Invite form -->
    {#if data.canManage}
      <div class="space-y-2">
        <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
          Invite member
        </p>
        <div class="flex gap-2 items-end">
          <div class="flex-1">
            <label
              class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              for="invite-username">Username</label
            >
            <input
              id="invite-username"
              type="text"
              bind:value={inviteUsername}
              placeholder="username"
              class="w-full h-9 rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
            />
          </div>
          <div>
            <label
              class="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              for="invite-role">Role</label
            >
            <select
              id="invite-role"
              bind:value={inviteRole}
              class="h-9 rounded-md border border-slate-300 px-3 text-sm bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="button"
            onclick={handleInvite}
            disabled={isInviting || !inviteUsername.trim()}
            class="h-9 px-4 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          >
            Invite
          </button>
        </div>

        {#if inviteError}
          <p class="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
        {/if}
        {#if inviteSuccess}
          <p class="text-sm text-green-600 dark:text-green-400">
            {inviteSuccess}
          </p>
        {/if}
      </div>

      <!-- Member list -->
      {#if data.members.length > 0}
        <div class="space-y-2">
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Members
          </p>
          <ul class="divide-y divide-slate-200 dark:divide-slate-700">
            {#each data.members as member (member.id)}
              <li class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  {#if member.image}
                    <img
                      src={member.image}
                      alt=""
                      class="w-8 h-8 rounded-full"
                    />
                  {:else}
                    <div
                      class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                    >
                      {(member.username ?? "?")[0]}
                    </div>
                  {/if}
                  <div>
                    <p
                      class="text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      {member.username ?? member.name ?? "Unknown"}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                      {getRoleLabel(member.role)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onclick={() => handleRemoveMember(member.userId)}
                  class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  Remove
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {:else}
        <p class="text-sm text-slate-500 dark:text-slate-400">
          No members yet. Invite someone above.
        </p>
      {/if}
    {/if}

    <div class="flex justify-end pt-2">
      <button
        type="button"
        onclick={() => (showShareModal = false)}
        class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
      >
        Done
      </button>
    </div>
  </div>
</Modal>

<!-- Edit Modal -->
<Modal bind:open={showEditModal} title="Edit Dashboard" maxWidth="max-w-md">
  <div class="space-y-4">
    <div class="space-y-2">
      <label
        class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        for="edit-title">Title</label
      >
      <input
        id="edit-title"
        type="text"
        bind:value={editTitle}
        class="w-full rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400 dark:placeholder:text-slate-500"
      />
    </div>

    <div class="space-y-2">
      <label
        class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        for="edit-description">Description</label
      >
      <textarea
        id="edit-description"
        rows="3"
        bind:value={editDescription}
        class="w-full rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:focus:border-blue-400 dark:placeholder:text-slate-500"
      ></textarea>
    </div>

    <div class="space-y-2">
      <span
        class="block text-sm font-semibold text-slate-700 dark:text-slate-300"
        >Visibility</span
      >
      <div
        class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
      >
        <label
          class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <input type="radio" value="public" bind:group={editVisibility} />
          Public
        </label>
        <label
          class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <input type="radio" value="private" bind:group={editVisibility} />
          Private (shareable link)
        </label>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        {visibilityDescriptions[editVisibility]}
      </p>
    </div>

    {#if editError}
      <p class="text-sm text-red-600 dark:text-red-400">{editError}</p>
    {/if}

    <div class="flex justify-end gap-3">
      <button
        type="button"
        onclick={() => (showEditModal = false)}
        class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleSaveEdit}
        disabled={isSaving}
        class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save"}
      </button>
    </div>
  </div>
</Modal>

<!-- Delete Confirmation -->
<Modal
  bind:open={showDeleteConfirm}
  title="Delete Dashboard?"
  maxWidth="max-w-sm"
  describedBy="delete-dashboard-description"
>
  <p
    id="delete-dashboard-description"
    class="text-slate-600 dark:text-slate-400"
  >
    This action cannot be undone. The dashboard will be permanently deleted.
    Counters will not be affected.
  </p>
  <div class="flex justify-end gap-3">
    <button
      type="button"
      onclick={() => (showDeleteConfirm = false)}
      class="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
    >
      Cancel
    </button>
    <button
      type="button"
      onclick={handleDelete}
      disabled={isDeleting}
      class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  </div>
</Modal>

<!-- Add Counter Modal -->
<AddCounterModal
  bind:open={showAddCounterModal}
  dashboardId={data.dashboard.id}
  {existingCounterIds}
  onAdd={handleAddCounter}
/>
