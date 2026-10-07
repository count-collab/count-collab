import { and, eq } from "drizzle-orm";
import { db } from "$lib/db";
import type { DashboardItem } from "$lib/db/schema";
import { dashboardItems } from "$lib/db/schema";
import {
  fitItemsToColumns,
  GRID_COLS,
  type GridItem,
  type RelayoutAction,
  relayoutGrid,
} from "$lib/server/grid-relayout";
import { logger } from "$lib/server/logger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toGridItem(item: DashboardItem): GridItem {
  return {
    id: item.id,
    positionX: item.positionX,
    positionY: item.positionY,
    sizeColumns: item.sizeColumns,
    sizeRows: item.sizeRows,
  };
}

function findChangedItems(before: GridItem[], after: GridItem[]): GridItem[] {
  return after.filter((newItem) => {
    const old = before.find((o) => o.id === newItem.id);
    if (!old) return false;
    return (
      old.positionX !== newItem.positionX ||
      old.positionY !== newItem.positionY ||
      old.sizeColumns !== newItem.sizeColumns ||
      old.sizeRows !== newItem.sizeRows
    );
  });
}

async function persistItemLayout(tx: Tx, items: GridItem[]): Promise<void> {
  for (const item of items) {
    await tx
      .update(dashboardItems)
      .set({
        positionX: item.positionX,
        positionY: item.positionY,
        sizeColumns: item.sizeColumns,
        sizeRows: item.sizeRows,
      })
      .where(eq(dashboardItems.id, item.id));
  }
}

export async function getDashboardItems(
  dashboardId: string,
): Promise<DashboardItem[]> {
  return (
    db
      .select()
      .from(dashboardItems)
      // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
      .where(eq(dashboardItems.dashboardId, dashboardId as any))
  );
}

export async function getDashboardItem(
  dashboardId: string,
  itemId: number,
): Promise<DashboardItem | null> {
  const [item] = await db
    .select()
    .from(dashboardItems)
    .where(
      and(
        // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
        eq(dashboardItems.dashboardId, dashboardId as any),
        eq(dashboardItems.id, itemId),
      ),
    );
  return item ?? null;
}

export async function addDashboardItem(
  dashboardId: string,
  counterId: string,
  positionX: number,
  positionY: number,
  sizeColumns = 1,
  sizeRows = 1,
): Promise<DashboardItem> {
  const [item] = await db
    .insert(dashboardItems)
    .values({
      dashboardId,
      counterId,
      positionX,
      positionY,
      sizeColumns,
      sizeRows,
    })
    .returning();

  logger.info("Dashboard item added", {
    dashboardId,
    counterId,
    itemId: item.id,
  });

  return item;
}

export async function removeDashboardItem(itemId: number): Promise<boolean> {
  const result = await db
    .delete(dashboardItems)
    .where(eq(dashboardItems.id, itemId))
    .returning();

  if (result.length > 0) {
    logger.info("Dashboard item removed", { itemId });
  }

  return result.length > 0;
}

export async function moveDashboardItem(
  itemId: number,
  positionX: number,
  positionY: number,
): Promise<DashboardItem | null> {
  const [updated] = await db
    .update(dashboardItems)
    .set({ positionX, positionY })
    .where(eq(dashboardItems.id, itemId))
    .returning();

  if (updated) {
    logger.info("Dashboard item moved", { itemId, positionX, positionY });
  }

  return updated ?? null;
}

export async function resizeDashboardItem(
  itemId: number,
  sizeColumns: number,
  sizeRows: number,
): Promise<DashboardItem | null> {
  const [updated] = await db
    .update(dashboardItems)
    .set({ sizeColumns, sizeRows })
    .where(eq(dashboardItems.id, itemId))
    .returning();

  if (updated) {
    logger.info("Dashboard item resized", { itemId, sizeColumns, sizeRows });
  }

  return updated ?? null;
}

export async function swapDashboardItems(
  itemId1: number,
  itemId2: number,
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const [item1] = await tx
      .select()
      .from(dashboardItems)
      .where(eq(dashboardItems.id, itemId1));

    const [item2] = await tx
      .select()
      .from(dashboardItems)
      .where(eq(dashboardItems.id, itemId2));

    if (!item1 || !item2) return false;

    await tx
      .update(dashboardItems)
      .set({ positionX: item2.positionX, positionY: item2.positionY })
      .where(eq(dashboardItems.id, itemId1));

    await tx
      .update(dashboardItems)
      .set({ positionX: item1.positionX, positionY: item1.positionY })
      .where(eq(dashboardItems.id, itemId2));

    logger.info("Dashboard items swapped", { itemId1, itemId2 });

    return true;
  });
}

export async function relayoutDashboardItems(
  dashboardId: string,
  action: RelayoutAction,
  gridCols: number = GRID_COLS,
): Promise<GridItem[]> {
  const allItems = await getDashboardItems(dashboardId);

  const gridItems = allItems.map(toGridItem);

  const newLayout = relayoutGrid(gridItems, action, gridCols);

  const changes = findChangedItems(gridItems, newLayout);

  if (changes.length === 0) return newLayout;

  // Batch-update all changed items in a single transaction
  await db.transaction((tx) => persistItemLayout(tx, changes));

  logger.info("Dashboard items relayout applied", {
    dashboardId,
    actionType: action.type,
    itemId: action.itemId,
    changedCount: changes.length,
  });

  return newLayout;
}

/** Re-fits all items of a dashboard to `gridColumns` within the caller's transaction. */
export async function refitDashboardItems(
  tx: Tx,
  dashboardId: string,
  gridColumns: number,
): Promise<number> {
  const allItems = await tx
    .select()
    .from(dashboardItems)
    // biome-ignore lint/suspicious/noExplicitAny: UUID type mismatch
    .where(eq(dashboardItems.dashboardId, dashboardId as any));

  const gridItems = allItems.map(toGridItem);
  const changes = findChangedItems(
    gridItems,
    fitItemsToColumns(gridItems, gridColumns),
  );

  await persistItemLayout(tx, changes);

  if (changes.length > 0) {
    logger.info("Dashboard items refit to grid columns", {
      dashboardId,
      gridColumns,
      changedCount: changes.length,
    });
  }

  return changes.length;
}
