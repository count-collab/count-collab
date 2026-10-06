import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEmit, mockGetIO } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockGetIO: vi.fn(),
}));

vi.mock("$lib/utils/socket-dev", () => ({
  getIO: mockGetIO,
}));

import { emitTeamMembershipChanged } from "./socket";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetIO.mockReturnValue({ emit: mockEmit });
});

describe("emitTeamMembershipChanged", () => {
  it("emits one event per affected user with only userId, teamId and reason", () => {
    emitTeamMembershipChanged(["user-1", "user-2"], {
      teamId: "team-1",
      reason: "team_deleted",
    });

    expect(mockEmit).toHaveBeenCalledTimes(2);
    expect(mockEmit).toHaveBeenNthCalledWith(1, "team:membership-changed", {
      userId: "user-1",
      teamId: "team-1",
      reason: "team_deleted",
    });
    expect(mockEmit).toHaveBeenNthCalledWith(2, "team:membership-changed", {
      userId: "user-2",
      teamId: "team-1",
      reason: "team_deleted",
    });
  });

  it("deduplicates user ids", () => {
    emitTeamMembershipChanged(["user-1", "user-1"], {
      teamId: "team-1",
      reason: "role_changed",
    });

    expect(mockEmit).toHaveBeenCalledOnce();
  });

  it("strips extra payload fields", () => {
    emitTeamMembershipChanged(["user-1"], {
      teamId: "team-1",
      reason: "joined",
      joinToken: "secret",
    } as never);

    expect(mockEmit).toHaveBeenCalledWith("team:membership-changed", {
      userId: "user-1",
      teamId: "team-1",
      reason: "joined",
    });
  });

  it("does nothing for an empty user list", () => {
    emitTeamMembershipChanged([], { teamId: "team-1", reason: "team_updated" });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("is a no-op when Socket.IO is not initialized", () => {
    mockGetIO.mockReturnValue(null);

    expect(() =>
      emitTeamMembershipChanged(["user-1"], {
        teamId: "team-1",
        reason: "removed",
      }),
    ).not.toThrow();
  });
});
