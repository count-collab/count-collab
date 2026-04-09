export const GRID_COLS = 5;
const MAX_ITERATIONS = 100;

export interface GridItem {
  id: number;
  positionX: number;
  positionY: number;
  sizeColumns: number;
  sizeRows: number;
}

export type RelayoutAction =
  | { type: "move"; itemId: number; positionX: number; positionY: number }
  | { type: "resize"; itemId: number; sizeColumns: number; sizeRows: number };

/**
 * Checks whether two items overlap on the grid.
 */
function itemsOverlap(a: GridItem, b: GridItem): boolean {
  const aRight = a.positionX + a.sizeColumns;
  const aBottom = a.positionY + a.sizeRows;
  const bRight = b.positionX + b.sizeColumns;
  const bBottom = b.positionY + b.sizeRows;

  return (
    a.positionX < bRight &&
    aRight > b.positionX &&
    a.positionY < bBottom &&
    aBottom > b.positionY
  );
}

/**
 * Finds all items that overlap with the given item (excluding itself).
 */
function findOverlapping(items: GridItem[], target: GridItem): GridItem[] {
  return items.filter(
    (item) => item.id !== target.id && itemsOverlap(item, target),
  );
}

/**
 * Checks if a set of items can physically fit (tile) inside a rectangle
 * defined by rx, ry, rw, rh without overlapping each other.
 */
function canFitInRect(
  itemsToFit: GridItem[],
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): { fits: boolean; placements: Map<number, { x: number; y: number }> } {
  const totalArea = itemsToFit.reduce(
    (sum, item) => sum + item.sizeColumns * item.sizeRows,
    0,
  );
  if (totalArea > rw * rh) {
    return { fits: false, placements: new Map() };
  }

  // Check that each item individually fits within the rectangle dimensions
  for (const item of itemsToFit) {
    if (item.sizeColumns > rw || item.sizeRows > rh) {
      return { fits: false, placements: new Map() };
    }
  }

  // Try to pack items left-to-right, top-to-bottom using a greedy approach
  const occupied: boolean[][] = Array.from({ length: rh }, () =>
    Array(rw).fill(false),
  );
  const placements = new Map<number, { x: number; y: number }>();

  // Sort by area descending for better packing
  const sorted = [...itemsToFit].sort(
    (a, b) => b.sizeColumns * b.sizeRows - a.sizeColumns * a.sizeRows,
  );

  for (const item of sorted) {
    let placed = false;
    for (let row = 0; row <= rh - item.sizeRows && !placed; row++) {
      for (let col = 0; col <= rw - item.sizeColumns && !placed; col++) {
        let canPlace = true;
        for (let dr = 0; dr < item.sizeRows && canPlace; dr++) {
          for (let dc = 0; dc < item.sizeColumns && canPlace; dc++) {
            if (occupied[row + dr][col + dc]) {
              canPlace = false;
            }
          }
        }
        if (canPlace) {
          for (let dr = 0; dr < item.sizeRows; dr++) {
            for (let dc = 0; dc < item.sizeColumns; dc++) {
              occupied[row + dr][col + dc] = true;
            }
          }
          placements.set(item.id, { x: rx + col, y: ry + row });
          placed = true;
        }
      }
    }
    if (!placed) {
      return { fits: false, placements: new Map() };
    }
  }

  return { fits: true, placements };
}

/**
 * Resolves overlaps by applying swap-or-displace logic with cascading.
 *
 * @param items - All grid items (mutable copies)
 * @param movedItem - The item that was just placed/resized
 * @param originalPosition - The original position of the moved item (for swap logic)
 * @param gridCols - Number of grid columns
 */
function resolveOverlaps(
  items: GridItem[],
  movedItem: GridItem,
  originalPosition: { x: number; y: number; w: number; h: number } | null,
): void {
  let iterations = 0;

  const processItem = (
    activeItem: GridItem,
    origPos: { x: number; y: number; w: number; h: number } | null,
  ) => {
    if (iterations >= MAX_ITERATIONS) return;
    iterations++;

    const overlapped = findOverlapping(items, activeItem);
    if (overlapped.length === 0) return;

    // Swap/fit logic only applies when there's a vacated rectangle (i.e. move, not resize)
    if (origPos) {
      // Rule 3: Swap vs Displace
      if (
        overlapped.length === 1 &&
        overlapped[0].sizeColumns === activeItem.sizeColumns &&
        overlapped[0].sizeRows === activeItem.sizeRows
      ) {
        // Exact same size — swap
        const other = items.find((i) => i.id === overlapped[0].id);
        if (!other) return;
        other.positionX = origPos.x;
        other.positionY = origPos.y;
        // Check if the swapped item now overlaps others
        processItem(other, {
          x: overlapped[0].positionX,
          y: overlapped[0].positionY,
          w: overlapped[0].sizeColumns,
          h: overlapped[0].sizeRows,
        });
        return;
      }

      // Check if all overlapped cards can fit in the vacated rectangle
      const { fits, placements } = canFitInRect(
        overlapped,
        origPos.x,
        origPos.y,
        origPos.w,
        origPos.h,
      );

      if (fits) {
        for (const overlapItem of overlapped) {
          const placement = placements.get(overlapItem.id);
          if (placement) {
            const itemRef = items.find((i) => i.id === overlapItem.id);
            if (!itemRef) continue;
            const prevX = itemRef.positionX;
            const prevY = itemRef.positionY;
            itemRef.positionX = placement.x;
            itemRef.positionY = placement.y;
            // Check if re-placed item now overlaps others
            processItem(itemRef, {
              x: prevX,
              y: prevY,
              w: itemRef.sizeColumns,
              h: itemRef.sizeRows,
            });
          }
        }
        return;
      }
    }

    // Displace: try shifting each overlapped item to the right first, then push down
    for (const overlapItem of overlapped) {
      if (iterations >= MAX_ITERATIONS) return;

      const itemRef = items.find((i) => i.id === overlapItem.id);
      if (!itemRef) continue;

      // Try shifting right: place just after the active item's right edge
      const shiftedX = activeItem.positionX + activeItem.sizeColumns;
      if (shiftedX + itemRef.sizeColumns <= GRID_COLS) {
        // Fits within grid width — shift right in the same row
        itemRef.positionX = shiftedX;
      } else {
        // Doesn't fit — displace to next row at X=0
        const displaceY = activeItem.positionY + activeItem.sizeRows;
        itemRef.positionX = 0;
        itemRef.positionY = displaceY;
      }

      // Recursively resolve any new overlaps
      processItem(itemRef, null);
    }
  };

  processItem(movedItem, originalPosition);
}

/**
 * Pure relayout function — no database access.
 * Takes all current grid items and an action, returns the new positions for ALL items.
 */
export function relayoutGrid(
  items: GridItem[],
  action: RelayoutAction,
  gridCols: number = GRID_COLS,
): GridItem[] {
  // Deep copy to avoid mutating inputs
  const result: GridItem[] = items.map((item) => ({ ...item }));

  const target = result.find((item) => item.id === action.itemId);
  if (!target) return result;

  const originalPosition = {
    x: target.positionX,
    y: target.positionY,
    w: target.sizeColumns,
    h: target.sizeRows,
  };

  if (action.type === "move") {
    // Clamp so the card doesn't exceed grid width
    target.positionX = Math.min(
      action.positionX,
      gridCols - target.sizeColumns,
    );
    target.positionX = Math.max(0, target.positionX);
    target.positionY = Math.max(0, action.positionY);

    // For move: resolve overlaps with swap/fit logic using the vacated position
    resolveOverlaps(result, target, originalPosition);
    return result;
  }
  // Resize
  target.sizeColumns = Math.min(action.sizeColumns, gridCols);
  target.sizeRows = action.sizeRows;

  // If it no longer fits at current X, try shifting left
  if (target.positionX + target.sizeColumns > gridCols) {
    const newX = gridCols - target.sizeColumns;
    if (newX >= 0) {
      // Check if the shifted position is free of other items
      const candidate: GridItem = { ...target, positionX: newX };
      const overlapsAtNewX = findOverlapping(result, candidate);
      if (overlapsAtNewX.length === 0) {
        target.positionX = newX;
      } else {
        // Try to find any X in the current row where it fits
        let placed = false;
        for (let testX = newX; testX >= 0; testX--) {
          const testCandidate: GridItem = { ...target, positionX: testX };
          if (findOverlapping(result, testCandidate).length === 0) {
            target.positionX = testX;
            placed = true;
            break;
          }
        }
        if (!placed) {
          // Can't fit in current row, move to next row at X=0
          target.positionX = 0;
          target.positionY = originalPosition.y + originalPosition.h;
        }
      }
    } else {
      // sizeColumns > gridCols shouldn't happen due to validation, but handle it
      target.positionX = 0;
    }
  }

  // For resize: no vacated rectangle — always displace overlapping items
  resolveOverlaps(result, target, null);

  return result;
}
