import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockInnerJoin,
  mockLeftJoin,
  mockInsert,
  mockInsertValues,
  mockInsertOnConflictDoUpdate,
  mockInsertReturning,
  mockUpdate,
  mockUpdateSet,
  mockUpdateWhere,
  mockUpdateReturning,
  mockDelete,
  mockDeleteWhere,
  mockDeleteReturning,
  mockTxSelect,
  mockTxFrom,
  mockTxWhere,
  mockTxInsert,
  mockTxInsertValues,
  mockTxInsertOnConflictDoUpdate,
  mockTxInsertReturning,
  mockTxDelete,
  mockTxDeleteWhere,
  mockTransaction,
  mockAs,
} = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockInnerJoin = vi.fn();
  const mockLeftJoin = vi.fn();
  const mockInsert = vi.fn();
  const mockInsertValues = vi.fn();
  const mockInsertOnConflictDoUpdate = vi.fn();
  const mockInsertReturning = vi.fn();
  const mockUpdate = vi.fn();
  const mockUpdateSet = vi.fn();
  const mockUpdateWhere = vi.fn();
  const mockUpdateReturning = vi.fn();
  const mockDelete = vi.fn();
  const mockDeleteWhere = vi.fn();
  const mockDeleteReturning = vi.fn();
  const mockTxSelect = vi.fn();
  const mockTxFrom = vi.fn();
  const mockTxWhere = vi.fn();
  const mockTxInsert = vi.fn();
  const mockTxInsertValues = vi.fn();
  const mockTxInsertOnConflictDoUpdate = vi.fn();
  const mockTxInsertReturning = vi.fn();
  const mockTxDelete = vi.fn();
  const mockTxDeleteWhere = vi.fn();
  const mockTransaction = vi.fn();
  const mockAs = vi
    .fn()
    .mockReturnValue({ id: "inviter.id", username: "inviter.username" });

  // Set up chains so module-level db.select().from().as() works at import time
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({
    innerJoin: mockInnerJoin,
    where: mockWhere,
    as: mockAs,
  });
  mockInnerJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
  mockLeftJoin.mockReturnValue({ where: mockWhere });
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
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
  mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });

  return {
    mockSelect,
    mockFrom,
    mockWhere,
    mockInnerJoin,
    mockLeftJoin,
    mockInsert,
    mockInsertValues,
    mockInsertOnConflictDoUpdate,
    mockInsertReturning,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockUpdateReturning,
    mockDelete,
    mockDeleteWhere,
    mockDeleteReturning,
    mockTxSelect,
    mockTxFrom,
    mockTxWhere,
    mockTxInsert,
    mockTxInsertValues,
    mockTxInsertOnConflictDoUpdate,
    mockTxInsertReturning,
    mockTxDelete,
    mockTxDeleteWhere,
    mockTransaction,
    mockAs,
  };
});

vi.mock("$lib/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function setupChains() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({
    innerJoin: mockInnerJoin,
    where: mockWhere,
    as: mockAs,
  });
  mockInnerJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
  mockLeftJoin.mockReturnValue({ where: mockWhere });
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
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
  mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });
}

function setupTxChains() {
  mockTxSelect.mockReturnValue({ from: mockTxFrom });
  mockTxFrom.mockReturnValue({ where: mockTxWhere });
  mockTxInsert.mockReturnValue({ values: mockTxInsertValues });
  mockTxInsertValues.mockReturnValue({
    onConflictDoUpdate: mockTxInsertOnConflictDoUpdate,
  });
  mockTxInsertOnConflictDoUpdate.mockReturnValue({
    returning: mockTxInsertReturning,
  });
  mockTxDelete.mockReturnValue({ where: mockTxDeleteWhere });
}

const tx = {
  select: (...args: unknown[]) => mockTxSelect(...args),
  insert: (...args: unknown[]) => mockTxInsert(...args),
  delete: (...args: unknown[]) => mockTxDelete(...args),
};

import {
  acceptDashboardInvitation,
  createDashboardInvitation,
  deleteDashboardInvitation,
  getDashboardInvitations,
  hasDashboardPendingInvitation,
  updateDashboardInvitationRole,
} from "./dashboard-invitations";

const mockInvitation = {
  id: "inv-1",
  dashboardId: "dash-1",
  userId: "user-1",
  invitedBy: "owner-1",
  role: "editor" as const,
  createdAt: new Date("2024-01-01"),
};

const mockInvitationWithUser = {
  ...mockInvitation,
  username: "alice",
  name: "Alice",
  image: null,
  inviterUsername: "bob",
};

describe("createDashboardInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("creates an invitation and returns it with user details", async () => {
    mockInsertReturning.mockResolvedValueOnce([mockInvitation]);
    mockWhere.mockResolvedValueOnce([mockInvitationWithUser]);

    const result = await createDashboardInvitation(
      "dash-1",
      "user-1",
      "editor",
      "owner-1",
    );

    expect(result).toEqual(mockInvitationWithUser);
    expect(mockInsertValues).toHaveBeenCalledWith({
      dashboardId: "dash-1",
      userId: "user-1",
      role: "editor",
      invitedBy: "owner-1",
    });
  });

  it("returns null when insert returns empty", async () => {
    mockInsertReturning.mockResolvedValueOnce([]);

    const result = await createDashboardInvitation(
      "dash-1",
      "user-1",
      "editor",
      "owner-1",
    );

    expect(result).toBeNull();
  });

  it("returns null when user join query returns empty", async () => {
    mockInsertReturning.mockResolvedValueOnce([mockInvitation]);
    mockWhere.mockResolvedValueOnce([]);

    const result = await createDashboardInvitation(
      "dash-1",
      "user-1",
      "editor",
      "owner-1",
    );

    expect(result).toBeNull();
  });
});

describe("deleteDashboardInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns true when invitation is deleted", async () => {
    mockDeleteReturning.mockResolvedValueOnce([mockInvitation]);

    const result = await deleteDashboardInvitation("dash-1", "user-1");

    expect(result).toBe(true);
  });

  it("returns false when invitation not found", async () => {
    mockDeleteReturning.mockResolvedValueOnce([]);

    const result = await deleteDashboardInvitation("dash-1", "user-1");

    expect(result).toBe(false);
  });
});

describe("updateDashboardInvitationRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("updates role and returns invitation with user details", async () => {
    mockUpdateReturning.mockResolvedValueOnce([mockInvitation]);
    mockWhere.mockResolvedValueOnce([mockInvitationWithUser]);

    const result = await updateDashboardInvitationRole(
      "dash-1",
      "user-1",
      "admin",
    );

    expect(result).toEqual(mockInvitationWithUser);
    expect(mockUpdateSet).toHaveBeenCalledWith({ role: "admin" });
  });

  it("returns null when invitation not found", async () => {
    mockUpdateReturning.mockResolvedValueOnce([]);

    const result = await updateDashboardInvitationRole(
      "dash-1",
      "user-1",
      "admin",
    );

    expect(result).toBeNull();
  });

  it("returns null when user join returns empty", async () => {
    mockUpdateReturning.mockResolvedValueOnce([mockInvitation]);
    mockWhere.mockResolvedValueOnce([]);

    const result = await updateDashboardInvitationRole(
      "dash-1",
      "user-1",
      "admin",
    );

    expect(result).toBeNull();
  });
});

describe("getDashboardInvitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns invitations with user details", async () => {
    mockWhere.mockResolvedValueOnce([mockInvitationWithUser]);

    const result = await getDashboardInvitations("dash-1");

    expect(result).toEqual([mockInvitationWithUser]);
  });

  it("returns empty array when no invitations exist", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const result = await getDashboardInvitations("dash-1");

    expect(result).toEqual([]);
  });
});

describe("acceptDashboardInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
    setupTxChains();
    mockTransaction.mockImplementation(async (fn: (tx: any) => unknown) =>
      fn(tx),
    );
  });

  it("accepts invitation: inserts member and deletes invitation", async () => {
    const invitation = {
      id: "inv-1",
      dashboardId: "dash-1",
      userId: "user-1",
      role: "editor",
    };
    const member = {
      id: 1,
      dashboardId: "dash-1",
      userId: "user-1",
      role: "editor",
    };

    mockTxWhere.mockResolvedValueOnce([invitation]);
    mockTxInsertReturning.mockResolvedValueOnce([member]);
    mockTxDeleteWhere.mockResolvedValueOnce(undefined);

    const result = await acceptDashboardInvitation("dash-1", "user-1");

    expect(result).toEqual(member);
    expect(mockTxInsertValues).toHaveBeenCalledWith({
      dashboardId: "dash-1",
      userId: "user-1",
      role: "editor",
    });
    expect(mockTxDelete).toHaveBeenCalledOnce();
  });

  it("returns null when invitation not found", async () => {
    mockTxWhere.mockResolvedValueOnce([]);

    const result = await acceptDashboardInvitation("dash-1", "user-1");

    expect(result).toBeNull();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });
});

describe("hasDashboardPendingInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChains();
  });

  it("returns true when invitation exists", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "inv-1" }]);

    const result = await hasDashboardPendingInvitation("dash-1", "user-1");

    expect(result).toBe(true);
  });

  it("returns false when no invitation exists", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const result = await hasDashboardPendingInvitation("dash-1", "user-1");

    expect(result).toBe(false);
  });
});
