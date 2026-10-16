import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamMemberRole } from "$lib/db/schema";

const {
  mockTransaction,
  mockTxSelect,
  mockTxFrom,
  mockTxWhere,
  mockTxUpdate,
  mockTxUpdateSet,
  mockTxUpdateWhere,
  mockLogEventInTx,
  mockGetActingTeamRole,
  mockLockWhere,
  mockLockFor,
  mockRemoveCounterFollowers,
  mockRemoveDashboardFollowers,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockTxSelect: vi.fn(),
  mockTxFrom: vi.fn(),
  mockTxWhere: vi.fn(),
  mockTxUpdate: vi.fn(),
  mockTxUpdateSet: vi.fn(),
  mockTxUpdateWhere: vi.fn(),
  mockLogEventInTx: vi.fn(),
  mockGetActingTeamRole: vi.fn(),
  mockLockWhere: vi.fn(),
  mockLockFor: vi.fn(),
  mockRemoveCounterFollowers: vi.fn(),
  mockRemoveDashboardFollowers: vi.fn(),
}));

vi.mock("$lib/server/followers", () => ({
  removeCounterFollowers: mockRemoveCounterFollowers,
  removeDashboardFollowers: mockRemoveDashboardFollowers,
}));

vi.mock("$lib/server/crypto", () => ({
  generateShareToken: () => "fresh-token",
}));

vi.mock("$lib/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("$lib/server/events", () => ({
  logEventInTx: mockLogEventInTx,
}));

vi.mock("$lib/server/team-authorize", () => ({
  getActingTeamRole: mockGetActingTeamRole,
}));

import { counters, dashboards, teamMembers } from "$lib/db/schema";
import { transferCounter, transferDashboard } from "./transfer";

const tx = { select: mockTxSelect, update: mockTxUpdate };

/** Query result that can be awaited directly or after `.for(...)`. */
function rows<T>(data: T[]) {
  return Object.assign(Promise.resolve(data), {
    for: () => Promise.resolve(data),
  });
}

/** Team roles of the actor, keyed by team id. */
function actorRoles(roles: Record<string, TeamMemberRole>) {
  mockGetActingTeamRole.mockImplementation(
    async (_userId: string, teamId: string) => roles[teamId] ?? null,
  );
}

const ACTOR = "actor";

beforeEach(() => {
  vi.clearAllMocks();
  mockTxSelect.mockReturnValue({ from: mockTxFrom });
  // Actor membership locks go to their own mock so they don't consume queued rows
  mockTxFrom.mockImplementation((table: unknown) =>
    table === teamMembers ? { where: mockLockWhere } : { where: mockTxWhere },
  );
  mockLockWhere.mockReturnValue({ for: mockLockFor });
  mockLockFor.mockResolvedValue([]);
  mockTxUpdate.mockReturnValue({ set: mockTxUpdateSet });
  mockTxUpdateSet.mockReturnValue({ where: mockTxUpdateWhere });
  mockTxUpdateWhere.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(async (fn: (tx: any) => unknown) =>
    fn(tx),
  );
});

/** Queue the counter row and (when a target team is given) the team-exists row. */
function queueCounter(
  counter: {
    ownerId: string | null;
    teamId: string | null;
    visibilityMode?: string;
  } | null,
  targetTeamId: string | null,
) {
  mockTxWhere.mockReturnValueOnce(
    rows(counter ? [{ visibilityMode: "public", ...counter }] : []),
  );
  if (targetTeamId)
    mockTxWhere.mockReturnValueOnce(rows([{ id: targetTeamId }]));
}

describe("transferCounter permission matrix", () => {
  type Case = {
    name: string;
    counter: { ownerId: string | null; teamId: string | null };
    target: string | null;
    roles: Record<string, TeamMemberRole>;
    expected: { ok: true } | { ok: false; status: number };
  };

  const cases: Case[] = [
    {
      name: "personal → team: owner with target editor",
      counter: { ownerId: ACTOR, teamId: null },
      target: "team-b",
      roles: { "team-b": "editor" },
      expected: { ok: true },
    },
    {
      name: "personal → team: owner with target incrementer",
      counter: { ownerId: ACTOR, teamId: null },
      target: "team-b",
      roles: { "team-b": "incrementer" },
      expected: { ok: false, status: 403 },
    },
    {
      name: "personal → team: non-owner even as target owner",
      counter: { ownerId: "someone-else", teamId: null },
      target: "team-b",
      roles: { "team-b": "owner" },
      expected: { ok: false, status: 403 },
    },
    {
      name: "team → personal: source owner",
      counter: { ownerId: "creator", teamId: "team-a" },
      target: null,
      roles: { "team-a": "owner" },
      expected: { ok: true },
    },
    {
      name: "team → personal: source admin cannot move out",
      counter: { ownerId: "creator", teamId: "team-a" },
      target: null,
      roles: { "team-a": "admin" },
      expected: { ok: false, status: 403 },
    },
    {
      name: "team → personal: source editor",
      counter: { ownerId: ACTOR, teamId: "team-a" },
      target: null,
      roles: { "team-a": "editor" },
      expected: { ok: false, status: 403 },
    },
    {
      name: "team → team: source owner, target editor",
      counter: { ownerId: "creator", teamId: "team-a" },
      target: "team-b",
      roles: { "team-a": "owner", "team-b": "editor" },
      expected: { ok: true },
    },
    {
      name: "team → team: source admin cannot move out even as target owner",
      counter: { ownerId: "creator", teamId: "team-a" },
      target: "team-b",
      roles: { "team-a": "admin", "team-b": "owner" },
      expected: { ok: false, status: 403 },
    },
    {
      name: "team → team: source owner, target viewer",
      counter: { ownerId: "creator", teamId: "team-a" },
      target: "team-b",
      roles: { "team-a": "owner", "team-b": "viewer" },
      expected: { ok: false, status: 403 },
    },
    {
      name: "team → team: source editor, target owner",
      counter: { ownerId: "creator", teamId: "team-a" },
      target: "team-b",
      roles: { "team-a": "editor", "team-b": "owner" },
      expected: { ok: false, status: 403 },
    },
    {
      name: "team → team: not a member of the target",
      counter: { ownerId: "creator", teamId: "team-a" },
      target: "team-b",
      roles: { "team-a": "owner" },
      expected: { ok: false, status: 404 },
    },
    {
      name: "team → team: platform admin (acting owner in both)",
      counter: { ownerId: "creator", teamId: "team-a" },
      target: "team-b",
      roles: { "team-a": "owner", "team-b": "owner" },
      expected: { ok: true },
    },
    {
      name: "same team is a no-op error",
      counter: { ownerId: "creator", teamId: "team-a" },
      target: "team-a",
      roles: { "team-a": "owner" },
      expected: { ok: false, status: 400 },
    },
    {
      name: "personal → personal is a no-op error",
      counter: { ownerId: ACTOR, teamId: null },
      target: null,
      roles: {},
      expected: { ok: false, status: 400 },
    },
  ];

  it.each(cases)("$name", async ({ counter, target, roles, expected }) => {
    actorRoles(roles);
    queueCounter(counter, target);

    const result = await transferCounter(ACTOR, "counter-1", target);

    expect(result).toMatchObject(expected);
    if (expected.ok) {
      expect(mockTxUpdate).toHaveBeenCalledWith(counters);
      expect(mockLogEventInTx).toHaveBeenCalledWith(tx, {
        eventType: "resource_transferred",
        userId: ACTOR,
        entityId: "counter-1",
        entityType: "counter",
        metadata: {
          resourceType: "counter",
          actorId: ACTOR,
          fromTeamId: counter.teamId,
          toTeamId: target,
        },
      });
    } else {
      expect(mockTxUpdate).not.toHaveBeenCalled();
      expect(mockLogEventInTx).not.toHaveBeenCalled();
    }
  });
});

describe("transferCounter", () => {
  it("team → personal makes the actor the owner and bumps updatedAt", async () => {
    actorRoles({ "team-a": "owner" });
    queueCounter({ ownerId: "creator", teamId: "team-a" }, null);

    await transferCounter(ACTOR, "counter-1", null);

    expect(mockTxUpdateSet).toHaveBeenCalledWith({
      teamId: null,
      ownerId: ACTOR,
      shareToken: null,
      updatedAt: expect.any(Date),
    });
  });

  it("leaving a team regenerates the token of a private counter", async () => {
    actorRoles({ "team-a": "owner" });
    queueCounter(
      { ownerId: "creator", teamId: "team-a", visibilityMode: "private" },
      null,
    );

    await transferCounter(ACTOR, "counter-1", null);

    expect(mockTxUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ shareToken: "fresh-token" }),
    );
  });

  it("leaving a team clears the token of a public counter", async () => {
    actorRoles({ "team-a": "owner", "team-b": "editor" });
    queueCounter(
      { ownerId: "creator", teamId: "team-a", visibilityMode: "public_readonly" },
      "team-b",
    );

    await transferCounter(ACTOR, "counter-1", "team-b");

    expect(mockTxUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: "team-b", shareToken: null }),
    );
  });

  it("leaving a team drops the counter's followers inside the transaction", async () => {
    actorRoles({ "team-a": "owner" });
    queueCounter({ ownerId: "creator", teamId: "team-a" }, null);

    await transferCounter(ACTOR, "counter-1", null);

    expect(mockRemoveCounterFollowers).toHaveBeenCalledWith("counter-1", tx);
  });

  it("moving into a team keeps token and followers", async () => {
    actorRoles({ "team-b": "editor" });
    queueCounter(
      { ownerId: ACTOR, teamId: null, visibilityMode: "private" },
      "team-b",
    );

    await transferCounter(ACTOR, "counter-1", "team-b");

    expect(mockTxUpdateSet.mock.calls[0][0]).not.toHaveProperty("shareToken");
    expect(mockRemoveCounterFollowers).not.toHaveBeenCalled();
  });

  it("an admin can still move a counter into the team", async () => {
    actorRoles({ "team-b": "admin" });
    queueCounter({ ownerId: ACTOR, teamId: null }, "team-b");

    await expect(transferCounter(ACTOR, "counter-1", "team-b")).resolves.toEqual({
      ok: true,
    });
  });

  it("does not put tokens or emails in the event metadata", async () => {
    actorRoles({ "team-a": "owner" });
    queueCounter(
      { ownerId: "creator", teamId: "team-a", visibilityMode: "private" },
      null,
    );

    await transferCounter(ACTOR, "counter-1", null);

    const { metadata } = mockLogEventInTx.mock.calls[0][1];
    expect(JSON.stringify(metadata)).not.toContain("fresh-token");
    expect(Object.keys(metadata).sort()).toEqual([
      "actorId",
      "fromTeamId",
      "resourceType",
      "toTeamId",
    ]);
  });

  it("personal → team keeps ownerId and sets teamId", async () => {
    actorRoles({ "team-b": "editor" });
    queueCounter({ ownerId: ACTOR, teamId: null }, "team-b");

    await transferCounter(ACTOR, "counter-1", "team-b");

    expect(mockTxUpdateSet).toHaveBeenCalledWith({
      teamId: "team-b",
      updatedAt: expect.any(Date),
    });
  });

  it("returns 404 when the counter does not exist", async () => {
    queueCounter(null, null);

    const result = await transferCounter(ACTOR, "missing", "team-b");

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Counter not found",
    });
  });

  it("returns 404 when the target team does not exist", async () => {
    actorRoles({ "team-b": "owner" });
    mockTxWhere
      .mockReturnValueOnce(rows([{ ownerId: ACTOR, teamId: null }]))
      .mockReturnValueOnce(rows([]));

    const result = await transferCounter(ACTOR, "counter-1", "team-b");

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Team not found",
    });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("share-locks the actor's source and target memberships before reading roles", async () => {
    actorRoles({ "team-a": "owner", "team-b": "editor" });
    queueCounter({ ownerId: "creator", teamId: "team-a" }, "team-b");

    const result = await transferCounter(ACTOR, "counter-1", "team-b");

    expect(result).toEqual({ ok: true });
    expect(mockLockFor).toHaveBeenCalledOnce();
    expect(mockLockFor).toHaveBeenCalledWith("share");
    expect(mockLockFor.mock.invocationCallOrder[0]).toBeLessThan(
      mockGetActingTeamRole.mock.invocationCallOrder[0],
    );
  });

  it("takes no membership lock for a personal → personal no-op", async () => {
    queueCounter({ ownerId: ACTOR, teamId: null }, null);

    const result = await transferCounter(ACTOR, "counter-1", null);

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mockLockWhere).not.toHaveBeenCalled();
  });
});

describe("transferDashboard", () => {
  /** Queue: dashboard, team exists, counters, dashboard items. */
  function queueDashboard(opts: {
    dashboard: {
      ownerId: string | null;
      teamId: string | null;
      visibilityMode?: string;
    };
    target: string | null;
    counters?: {
      id: string;
      title: string;
      ownerId: string | null;
      teamId: string | null;
      visibilityMode?: string;
    }[];
    itemCounterIds?: string[];
  }) {
    mockTxWhere.mockReturnValueOnce(
      rows([{ visibilityMode: "public", ...opts.dashboard }]),
    );
    if (opts.target)
      mockTxWhere.mockReturnValueOnce(rows([{ id: opts.target }]));
    if (opts.counters) {
      mockTxWhere.mockReturnValueOnce(
        rows(opts.counters.map((c) => ({ visibilityMode: "public", ...c }))),
      );
      mockTxWhere.mockReturnValueOnce(
        rows((opts.itemCounterIds ?? []).map((counterId) => ({ counterId }))),
      );
    }
  }

  it("moves the dashboard and listed counters in one transaction", async () => {
    actorRoles({ "team-b": "editor" });
    queueDashboard({
      dashboard: { ownerId: ACTOR, teamId: null },
      target: "team-b",
      counters: [
        { id: "c1", title: "One", ownerId: ACTOR, teamId: null },
        { id: "c2", title: "Two", ownerId: ACTOR, teamId: null },
      ],
      itemCounterIds: ["c1", "c2"],
    });

    const result = await transferDashboard(ACTOR, "dash-1", "team-b", [
      "c1",
      "c2",
      "c1",
    ]);

    expect(result).toEqual({ ok: true });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTxUpdate).toHaveBeenCalledWith(dashboards);
    expect(mockTxUpdate).toHaveBeenCalledWith(counters);
    expect(mockLogEventInTx).toHaveBeenCalledTimes(3);
    expect(mockLogEventInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        entityId: "dash-1",
        metadata: {
          resourceType: "dashboard",
          actorId: ACTOR,
          fromTeamId: null,
          toTeamId: "team-b",
        },
      }),
    );
  });

  it("moves only the dashboard when no counters are listed", async () => {
    actorRoles({ "team-a": "owner" });
    queueDashboard({
      dashboard: { ownerId: "creator", teamId: "team-a" },
      target: null,
    });

    const result = await transferDashboard(ACTOR, "dash-1", null, []);

    expect(result).toEqual({ ok: true });
    expect(mockTxUpdate).toHaveBeenCalledOnce();
    expect(mockTxUpdateSet).toHaveBeenCalledWith({
      teamId: null,
      ownerId: ACTOR,
      shareToken: null,
      updatedAt: expect.any(Date),
    });
  });

  it("leaving a team regenerates a private dashboard's token and drops its followers", async () => {
    actorRoles({ "team-a": "owner" });
    queueDashboard({
      dashboard: {
        ownerId: "creator",
        teamId: "team-a",
        visibilityMode: "private",
      },
      target: null,
    });

    await transferDashboard(ACTOR, "dash-1", null, []);

    expect(mockTxUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ shareToken: "fresh-token" }),
    );
    expect(mockRemoveDashboardFollowers).toHaveBeenCalledWith("dash-1", tx);
    expect(mockRemoveCounterFollowers).not.toHaveBeenCalled();
  });

  it("leaving a team also resets tokens and followers of the counters moved along", async () => {
    actorRoles({ "team-a": "owner" });
    queueDashboard({
      dashboard: { ownerId: "creator", teamId: "team-a" },
      target: null,
      counters: [
        {
          id: "c1",
          title: "One",
          ownerId: "x",
          teamId: "team-a",
          visibilityMode: "private",
        },
        { id: "c2", title: "Two", ownerId: "x", teamId: "team-a" },
      ],
      itemCounterIds: ["c1", "c2"],
    });

    const result = await transferDashboard(ACTOR, "dash-1", null, ["c1", "c2"]);

    expect(result).toEqual({ ok: true });
    const counterSets = mockTxUpdateSet.mock.calls
      .map((c) => c[0])
      .filter((s) => s.shareToken !== undefined);
    expect(counterSets.map((s) => s.shareToken)).toEqual([
      null,
      "fresh-token",
      null,
    ]);
    expect(mockRemoveCounterFollowers).toHaveBeenCalledWith("c1", tx);
    expect(mockRemoveCounterFollowers).toHaveBeenCalledWith("c2", tx);
  });

  it("an admin cannot move a dashboard out of the team", async () => {
    actorRoles({ "team-a": "admin" });
    queueDashboard({
      dashboard: { ownerId: "creator", teamId: "team-a" },
      target: null,
    });

    const result = await transferDashboard(ACTOR, "dash-1", null, []);

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockRemoveDashboardFollowers).not.toHaveBeenCalled();
  });

  it("aborts when an admin lists a counter owned by a team they only administer", async () => {
    actorRoles({ "team-b": "editor", "team-a": "admin" });
    queueDashboard({
      dashboard: { ownerId: ACTOR, teamId: null },
      target: "team-b",
      counters: [{ id: "c1", title: "One", ownerId: "x", teamId: "team-a" }],
      itemCounterIds: ["c1"],
    });

    const result = await transferDashboard(ACTOR, "dash-1", "team-b", ["c1"]);

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("rejects a counter that is not on the dashboard without leaking its title", async () => {
    actorRoles({ "team-b": "editor" });
    queueDashboard({
      dashboard: { ownerId: ACTOR, teamId: null },
      target: "team-b",
      counters: [
        { id: "c1", title: "On board", ownerId: ACTOR, teamId: null },
        { id: "c2", title: "Elsewhere", ownerId: ACTOR, teamId: null },
      ],
      itemCounterIds: ["c1"],
    });

    const result = await transferDashboard(ACTOR, "dash-1", "team-b", [
      "c1",
      "c2",
    ]);

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "Counter c2 is not on this dashboard",
    });
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockLogEventInTx).not.toHaveBeenCalled();
  });

  it("rejects an unknown counter id", async () => {
    actorRoles({ "team-b": "editor" });
    queueDashboard({
      dashboard: { ownerId: ACTOR, teamId: null },
      target: "team-b",
      counters: [],
      itemCounterIds: [],
    });

    const result = await transferDashboard(ACTOR, "dash-1", "team-b", [
      "ghost",
    ]);

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "Counter ghost is not on this dashboard",
    });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("aborts when a listed counter fails the transfer rules", async () => {
    actorRoles({ "team-b": "editor" });
    queueDashboard({
      dashboard: { ownerId: ACTOR, teamId: null },
      target: "team-b",
      counters: [
        { id: "c1", title: "Not mine", ownerId: "someone-else", teamId: null },
      ],
      itemCounterIds: ["c1"],
    });

    const result = await transferDashboard(ACTOR, "dash-1", "team-b", ["c1"]);

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(result.ok ? "" : result.message).toContain("c1");
    expect(result.ok ? "" : result.message).not.toContain("Not mine");
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("applies the matrix to the dashboard itself", async () => {
    actorRoles({ "team-a": "editor", "team-b": "owner" });
    queueDashboard({
      dashboard: { ownerId: "creator", teamId: "team-a" },
      target: "team-b",
    });

    const result = await transferDashboard(ACTOR, "dash-1", "team-b", []);

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("share-locks the actor's memberships in counters' source teams", async () => {
    actorRoles({ "team-a": "owner", "team-b": "editor", "team-c": "owner" });
    queueDashboard({
      dashboard: { ownerId: "creator", teamId: "team-a" },
      target: "team-b",
      counters: [{ id: "c1", title: "One", ownerId: "x", teamId: "team-c" }],
      itemCounterIds: ["c1"],
    });

    const result = await transferDashboard(ACTOR, "dash-1", "team-b", ["c1"]);

    expect(result).toEqual({ ok: true });
    expect(mockLockFor).toHaveBeenCalledTimes(2);
    expect(mockLockFor).toHaveBeenNthCalledWith(1, "share");
    expect(mockLockFor).toHaveBeenNthCalledWith(2, "share");
  });

  it("returns 404 when the dashboard does not exist", async () => {
    mockTxWhere.mockReturnValueOnce(rows([]));

    const result = await transferDashboard(ACTOR, "missing", null, []);

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Dashboard not found",
    });
  });

  it("returns 404 when the target team does not exist", async () => {
    actorRoles({ "team-b": "owner" });
    mockTxWhere
      .mockReturnValueOnce(rows([{ ownerId: ACTOR, teamId: null }]))
      .mockReturnValueOnce(rows([]));

    const result = await transferDashboard(ACTOR, "dash-1", "team-b", ["c1"]);

    expect(result).toEqual({
      ok: false,
      status: 404,
      message: "Team not found",
    });
    expect(mockLockWhere).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});
