import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CounterMember } from "$lib/db/schema";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertOnConflictDoUpdate = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();

const mockLoggerInfo = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
  },
}));

mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockInsert.mockReturnValue({ values: mockInsertValues });
mockInsertValues.mockReturnValue({
  onConflictDoUpdate: mockInsertOnConflictDoUpdate,
});
mockInsertOnConflictDoUpdate.mockReturnValue({
  returning: mockInsertReturning,
});
mockUpdate.mockReturnValue({ set: mockUpdateSet });
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });

import {
  getMembershipCount,
  getUserCounterRole,
  inviteUserByUsername,
  updateMemberRole,
} from "./members";

function makeMember(overrides: Partial<CounterMember> = {}): CounterMember {
  return {
    id: 1,
    counterId: "counter-1",
    userId: "user-1",
    role: "viewer",
    invitedAt: new Date(),
    ...overrides,
  };
}

describe("members service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({
      onConflictDoUpdate: mockInsertOnConflictDoUpdate,
    });
    mockInsertOnConflictDoUpdate.mockReturnValue({
      returning: mockInsertReturning,
    });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
  });

  it("invites users with the incrementer role", async () => {
    const member = makeMember({ role: "incrementer" });
    mockWhere.mockResolvedValueOnce([{ id: "user-1" }]);
    mockInsertReturning.mockResolvedValueOnce([member]);

    await expect(
      inviteUserByUsername("counter-1", "alice", "incrementer"),
    ).resolves.toEqual(member);

    expect(mockInsertValues).toHaveBeenCalledWith({
      counterId: "counter-1",
      userId: "user-1",
      role: "incrementer",
    });
    expect(mockInsertOnConflictDoUpdate).toHaveBeenCalledWith({
      target: expect.any(Array),
      set: { role: "incrementer" },
    });
    expect(mockLoggerInfo).toHaveBeenCalledWith("User invited to counter", {
      counterId: "counter-1",
      username: "alice",
      role: "incrementer",
      userId: "user-1",
    });
  });

  it("updates members to the incrementer role", async () => {
    const member = makeMember({ role: "incrementer" });
    mockUpdateReturning.mockResolvedValueOnce([member]);

    await expect(
      updateMemberRole("counter-1", "user-1", "incrementer"),
    ).resolves.toEqual(member);

    expect(mockUpdateSet).toHaveBeenCalledWith({ role: "incrementer" });
  });

  it("returns incrementer from user role lookups", async () => {
    mockWhere.mockResolvedValueOnce([{ role: "incrementer" }]);

    await expect(getUserCounterRole("user-1", "counter-1")).resolves.toBe(
      "incrementer",
    );
  });
});

describe("getMembershipCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
  });

  it("returns the count of memberships", async () => {
    mockWhere.mockResolvedValue([{ count: "5" }]);

    const result = await getMembershipCount("user-1");

    expect(result).toBe(5);
    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledOnce();
  });

  it("returns 0 when user has no memberships", async () => {
    mockWhere.mockResolvedValue([{ count: "0" }]);

    const result = await getMembershipCount("user-1");

    expect(result).toBe(0);
  });

  it("returns 0 when row is undefined", async () => {
    mockWhere.mockResolvedValue([]);

    const result = await getMembershipCount("user-1");

    expect(result).toBe(0);
  });
});
