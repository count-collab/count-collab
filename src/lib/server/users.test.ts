import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDeleteReturning = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockDelete.mockReturnValue({ where: mockDeleteWhere });
mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });

import { deleteUser, getConnectedProviders } from "./users";

describe("deleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
  });

  it("deletes owned counters first, then deletes user, returns true", async () => {
    // First delete call (counters): db.delete(counters).where(...) — awaited directly
    mockDeleteWhere.mockResolvedValueOnce(undefined);
    // Second delete call (users): db.delete(users).where(...).returning()
    mockDeleteWhere.mockReturnValueOnce({ returning: mockDeleteReturning });
    mockDeleteReturning.mockResolvedValueOnce([{ id: "user-1" }]);

    const result = await deleteUser("user-1");

    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(2);
  });

  it("returns false when user not found", async () => {
    mockDeleteWhere.mockResolvedValueOnce(undefined);
    mockDeleteWhere.mockReturnValueOnce({ returning: mockDeleteReturning });
    mockDeleteReturning.mockResolvedValueOnce([]);

    const result = await deleteUser("nonexistent");

    expect(result).toBe(false);
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });
});

describe("getConnectedProviders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
  });

  it("returns list of provider names", async () => {
    mockWhere.mockResolvedValueOnce([
      { provider: "github" },
      { provider: "google" },
    ]);

    const result = await getConnectedProviders("user-1");

    expect(result).toEqual(["github", "google"]);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledOnce();
  });

  it("returns empty array when no providers connected", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const result = await getConnectedProviders("user-1");

    expect(result).toEqual([]);
  });
});
