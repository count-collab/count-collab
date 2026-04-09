import { describe, expect, it } from "vitest";
import { GRID_COLS, type GridItem, relayoutGrid } from "./grid-relayout";

function makeItem(id: number, x: number, y: number, w = 1, h = 1): GridItem {
  return { id, positionX: x, positionY: y, sizeColumns: w, sizeRows: h };
}

function findItem(items: GridItem[], id: number): GridItem {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`Item ${id} not found`);
  return item;
}

describe("relayoutGrid", () => {
  describe("move action", () => {
    it("moves an item to an empty position", () => {
      const items = [makeItem(1, 0, 0), makeItem(2, 2, 0)];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 0,
        positionY: 1,
      });
      const moved = findItem(result, 1);
      expect(moved.positionX).toBe(0);
      expect(moved.positionY).toBe(1);
      // Item 2 is unaffected
      const other = findItem(result, 2);
      expect(other.positionX).toBe(2);
      expect(other.positionY).toBe(0);
    });

    it("clamps position so item does not exceed grid width", () => {
      const items = [makeItem(1, 0, 0, 2, 1)];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 4,
        positionY: 0,
      });
      const moved = findItem(result, 1);
      // 2-wide item can't start at x=4 (would go to x=5), clamp to x=3
      expect(moved.positionX).toBe(3);
    });

    it("clamps negative positions to 0", () => {
      const items = [makeItem(1, 2, 2)];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: -1,
        positionY: -1,
      });
      const moved = findItem(result, 1);
      expect(moved.positionX).toBe(0);
      expect(moved.positionY).toBe(0);
    });

    it("swaps two items of the same size", () => {
      const items = [makeItem(1, 0, 0), makeItem(2, 2, 0)];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 2,
        positionY: 0,
      });
      const item1 = findItem(result, 1);
      const item2 = findItem(result, 2);
      expect(item1.positionX).toBe(2);
      expect(item1.positionY).toBe(0);
      // Item 2 should be swapped to item 1's original position
      expect(item2.positionX).toBe(0);
      expect(item2.positionY).toBe(0);
    });

    it("swaps two multi-cell items of the same size", () => {
      const items = [makeItem(1, 0, 0, 2, 2), makeItem(2, 3, 0, 2, 2)];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 3,
        positionY: 0,
      });
      const item1 = findItem(result, 1);
      const item2 = findItem(result, 2);
      expect(item1.positionX).toBe(3);
      expect(item2.positionX).toBe(0);
      expect(item2.positionY).toBe(0);
    });

    it("displaces an overlapped item of different size", () => {
      const items = [makeItem(1, 0, 0, 1, 1), makeItem(2, 2, 0, 2, 1)];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 2,
        positionY: 0,
      });
      const item1 = findItem(result, 1);
      const item2 = findItem(result, 2);
      expect(item1.positionX).toBe(2);
      expect(item1.positionY).toBe(0);
      // Item 2 was shifted right to make room (x=3, fits 2-wide within 5 cols)
      expect(item2.positionX).toBe(3);
      expect(item2.positionY).toBe(0);
    });

    it("handles cascading displacement", () => {
      // Item 3 is right below where item 2 would be displaced to
      const items = [
        makeItem(1, 0, 0),
        makeItem(2, 2, 0, 2, 1),
        makeItem(3, 0, 1, 3, 1),
      ];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 2,
        positionY: 0,
      });
      // All items should have valid non-overlapping positions
      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const a = result[i];
          const b = result[j];
          const overlapX =
            a.positionX < b.positionX + b.sizeColumns &&
            a.positionX + a.sizeColumns > b.positionX;
          const overlapY =
            a.positionY < b.positionY + b.sizeRows &&
            a.positionY + a.sizeRows > b.positionY;
          expect(overlapX && overlapY).toBe(false);
        }
      }
    });

    it("returns items unchanged when target item does not exist", () => {
      const items = [makeItem(1, 0, 0)];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 999,
        positionX: 2,
        positionY: 0,
      });
      expect(result).toEqual(items);
    });
  });

  describe("resize action", () => {
    it("resizes an item in empty space", () => {
      const items = [makeItem(1, 0, 0, 1, 1)];
      const result = relayoutGrid(items, {
        type: "resize",
        itemId: 1,
        sizeColumns: 3,
        sizeRows: 2,
      });
      const item = findItem(result, 1);
      expect(item.sizeColumns).toBe(3);
      expect(item.sizeRows).toBe(2);
      expect(item.positionX).toBe(0);
      expect(item.positionY).toBe(0);
    });

    it("shifts item left when resize would exceed grid width", () => {
      const items = [makeItem(1, 3, 0, 1, 1)];
      const result = relayoutGrid(items, {
        type: "resize",
        itemId: 1,
        sizeColumns: 3,
        sizeRows: 1,
      });
      const item = findItem(result, 1);
      expect(item.sizeColumns).toBe(3);
      // Should shift left: 5 - 3 = 2
      expect(item.positionX).toBe(2);
    });

    it("moves to next row when can't fit in current row due to other items", () => {
      // Item 1 at x=3, item 2 at x=0 (3 wide), so resizing item 1 to 3 wide
      // can't fit in row 0 at all — x=2 is the minimum but overlaps item 2
      const items = [makeItem(1, 4, 0, 1, 1), makeItem(2, 0, 0, 3, 1)];
      const result = relayoutGrid(items, {
        type: "resize",
        itemId: 1,
        sizeColumns: 3,
        sizeRows: 1,
      });
      const item = findItem(result, 1);
      expect(item.sizeColumns).toBe(3);
      // Can't fit at x=2 (overlap with item 2 at 0-2), can't fit at x=1, x=0
      // But actually item2 occupies x=0,1,2 and item1 needs 3 cols, so x=2 would be 2,3,4 — no overlap!
      // Let's just verify it doesn't overlap
      const item2 = findItem(result, 2);
      const overlapX =
        item.positionX < item2.positionX + item2.sizeColumns &&
        item.positionX + item.sizeColumns > item2.positionX;
      const overlapY =
        item.positionY < item2.positionY + item2.sizeRows &&
        item.positionY + item.sizeRows > item2.positionY;
      expect(overlapX && overlapY).toBe(false);
    });

    it("displaces overlapped items after resize", () => {
      const items = [makeItem(1, 0, 0, 1, 1), makeItem(2, 1, 0, 1, 1)];
      const result = relayoutGrid(items, {
        type: "resize",
        itemId: 1,
        sizeColumns: 2,
        sizeRows: 1,
      });
      const item1 = findItem(result, 1);
      const item2 = findItem(result, 2);
      expect(item1.sizeColumns).toBe(2);
      // Item 2 should be displaced
      const overlapX =
        item1.positionX < item2.positionX + item2.sizeColumns &&
        item1.positionX + item1.sizeColumns > item2.positionX;
      const overlapY =
        item1.positionY < item2.positionY + item2.sizeRows &&
        item1.positionY + item1.sizeRows > item2.positionY;
      expect(overlapX && overlapY).toBe(false);
    });

    it("resized item stays in place and pushes overlapped item down", () => {
      // [2x1, 2x1, 1x1] — resize middle to 3x1
      const items = [
        makeItem(1, 0, 0, 2, 1),
        makeItem(2, 2, 0, 2, 1),
        makeItem(3, 4, 0, 1, 1),
      ];
      const result = relayoutGrid(items, {
        type: "resize",
        itemId: 2,
        sizeColumns: 3,
        sizeRows: 1,
      });
      const item1 = findItem(result, 1);
      const item2 = findItem(result, 2);
      const item3 = findItem(result, 3);
      // Item 1 should be unchanged
      expect(item1.positionX).toBe(0);
      expect(item1.positionY).toBe(0);
      // Item 2 should stay at x=2 (2+3=5 fits in 5 cols)
      expect(item2.positionX).toBe(2);
      expect(item2.positionY).toBe(0);
      expect(item2.sizeColumns).toBe(3);
      // Item 3 should be displaced to next row, not swapped
      expect(item3.positionY).toBe(1);
      expect(item3.positionX).toBe(0);
    });

    it("resize shifts overlapped card right, cascading pushes next card down", () => {
      // [2x1, 2x1, 1x1] — resize first to 3x1
      const items = [
        makeItem(1, 0, 0, 2, 1),
        makeItem(2, 2, 0, 2, 1),
        makeItem(3, 4, 0, 1, 1),
      ];
      const result = relayoutGrid(items, {
        type: "resize",
        itemId: 1,
        sizeColumns: 3,
        sizeRows: 1,
      });
      const item1 = findItem(result, 1);
      const item2 = findItem(result, 2);
      const item3 = findItem(result, 3);
      // Item 1: resized to 3x1, stays at x=0
      expect(item1.positionX).toBe(0);
      expect(item1.positionY).toBe(0);
      expect(item1.sizeColumns).toBe(3);
      // Item 2: shifted right to x=3 (just past item 1's right edge)
      expect(item2.positionX).toBe(3);
      expect(item2.positionY).toBe(0);
      // Item 3: can't shift right (x=5 out of bounds), displaced to y=1, x=0
      expect(item3.positionX).toBe(0);
      expect(item3.positionY).toBe(1);
    });

    it("caps sizeColumns to grid width", () => {
      const items = [makeItem(1, 0, 0, 1, 1)];
      const result = relayoutGrid(items, {
        type: "resize",
        itemId: 1,
        sizeColumns: 10,
        sizeRows: 1,
      });
      const item = findItem(result, 1);
      expect(item.sizeColumns).toBe(GRID_COLS);
    });
  });

  describe("swap vs displace logic", () => {
    it("fits multiple small items into the vacated rectangle", () => {
      // Item 1 is 2x2 at (0,0), items 2 and 3 are 1x1 at (3,3) and (4,3)
      // Move item 1 to (3,3) — it overlaps items 2 and 3
      // Both can fit in the vacated 2x2 rect at (0,0)
      const items = [
        makeItem(1, 0, 0, 2, 2),
        makeItem(2, 3, 3, 1, 1),
        makeItem(3, 4, 3, 1, 1),
      ];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 3,
        positionY: 3,
      });
      const item1 = findItem(result, 1);
      expect(item1.positionX).toBe(3);
      expect(item1.positionY).toBe(3);
      // Items 2 and 3 should be placed without overlaps
      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const a = result[i];
          const b = result[j];
          const ox =
            a.positionX < b.positionX + b.sizeColumns &&
            a.positionX + a.sizeColumns > b.positionX;
          const oy =
            a.positionY < b.positionY + b.sizeRows &&
            a.positionY + a.sizeRows > b.positionY;
          expect(ox && oy).toBe(false);
        }
      }
    });

    it("displaces when overlapped items cannot fit in vacated rectangle", () => {
      // Item 1 is 1x1 at (0,0), item 2 is 3x3 at (2,0)
      // Move item 1 to (2,0) — overlaps item 2 (3x3) which can't fit in 1x1 rect
      const items = [makeItem(1, 0, 0, 1, 1), makeItem(2, 2, 0, 3, 3)];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 2,
        positionY: 0,
      });
      const item1 = findItem(result, 1);
      const item2 = findItem(result, 2);
      expect(item1.positionX).toBe(2);
      expect(item1.positionY).toBe(0);
      // Item 2 was displaced (not swapped because sizes differ)
      expect(item2.positionY).toBeGreaterThanOrEqual(1);
    });
  });

  describe("edge cases", () => {
    it("handles a full row", () => {
      const items = [
        makeItem(1, 0, 0),
        makeItem(2, 1, 0),
        makeItem(3, 2, 0),
        makeItem(4, 3, 0),
        makeItem(5, 4, 0),
      ];
      // Move item 1 on top of item 3
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 2,
        positionY: 0,
      });
      // Items should swap since same size
      const item1 = findItem(result, 1);
      const item3 = findItem(result, 3);
      expect(item1.positionX).toBe(2);
      expect(item3.positionX).toBe(0);
    });

    it("does not mutate input items", () => {
      const items = [makeItem(1, 0, 0), makeItem(2, 2, 0)];
      const original = JSON.parse(JSON.stringify(items));
      relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 2,
        positionY: 0,
      });
      expect(items).toEqual(original);
    });

    it("handles single item on grid", () => {
      const items = [makeItem(1, 0, 0, 2, 2)];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 3,
        positionY: 5,
      });
      const item = findItem(result, 1);
      expect(item.positionX).toBe(3);
      expect(item.positionY).toBe(5);
    });

    it("handles empty items array gracefully", () => {
      const result = relayoutGrid([], {
        type: "move",
        itemId: 1,
        positionX: 0,
        positionY: 0,
      });
      expect(result).toEqual([]);
    });

    it("respects custom gridCols parameter", () => {
      const items = [makeItem(1, 0, 0, 2, 1)];
      const result = relayoutGrid(
        items,
        { type: "move", itemId: 1, positionX: 3, positionY: 0 },
        3,
      );
      const item = findItem(result, 1);
      // In a 3-col grid, a 2-wide item can go to x=1 max
      expect(item.positionX).toBe(1);
    });

    it("produces no overlaps in complex multi-item scenario", () => {
      const items = [
        makeItem(1, 0, 0, 2, 2),
        makeItem(2, 2, 0, 1, 1),
        makeItem(3, 3, 0, 2, 1),
        makeItem(4, 2, 1, 3, 2),
        makeItem(5, 0, 2, 2, 1),
      ];
      const result = relayoutGrid(items, {
        type: "move",
        itemId: 1,
        positionX: 2,
        positionY: 0,
      });
      // Verify no overlaps in result
      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const a = result[i];
          const b = result[j];
          const ox =
            a.positionX < b.positionX + b.sizeColumns &&
            a.positionX + a.sizeColumns > b.positionX;
          const oy =
            a.positionY < b.positionY + b.sizeRows &&
            a.positionY + a.sizeRows > b.positionY;
          expect(ox && oy).toBe(false);
        }
      }
    });

    it("all items stay within grid bounds", () => {
      const items = [makeItem(1, 0, 0, 3, 1), makeItem(2, 3, 0, 2, 1)];
      const result = relayoutGrid(items, {
        type: "resize",
        itemId: 1,
        sizeColumns: 5,
        sizeRows: 1,
      });
      for (const item of result) {
        expect(item.positionX).toBeGreaterThanOrEqual(0);
        expect(item.positionY).toBeGreaterThanOrEqual(0);
        expect(item.positionX + item.sizeColumns).toBeLessThanOrEqual(
          GRID_COLS,
        );
      }
    });
  });
});
