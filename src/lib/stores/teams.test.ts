import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamMembershipChangedPayload } from "./teams";

const { env, mockGetSocket } = vi.hoisted(() => ({
  env: { browser: true },
  mockGetSocket: vi.fn(),
}));

vi.mock("$app/environment", () => ({
  get browser() {
    return env.browser;
  },
}));

vi.mock("./socket", () => ({ getSocket: mockGetSocket }));

type Handler = (payload: TeamMembershipChangedPayload) => void;

function makeSocket() {
  const handlers = new Map<string, Handler>();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    emit(event: string, payload: TeamMembershipChangedPayload) {
      handlers.get(event)?.(payload);
    },
  };
}

const payload: TeamMembershipChangedPayload = {
  userId: "user-1",
  teamId: "team-1",
  reason: "joined",
};

// Fresh module per test: the socket registration flag is module-level state
async function loadStore() {
  vi.resetModules();
  return import("./teams");
}

describe("onTeamMembershipChanged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.browser = true;
  });

  it("returns a no-op unsubscribe and never touches the socket on the server", async () => {
    env.browser = false;
    const { onTeamMembershipChanged } = await loadStore();

    const unsubscribe = onTeamMembershipChanged(vi.fn());

    expect(mockGetSocket).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it("forwards team:membership-changed payloads to every listener", async () => {
    const socket = makeSocket();
    mockGetSocket.mockReturnValue(socket);
    const { onTeamMembershipChanged } = await loadStore();
    const a = vi.fn();
    const b = vi.fn();

    onTeamMembershipChanged(a);
    onTeamMembershipChanged(b);
    socket.emit("team:membership-changed", payload);

    expect(a).toHaveBeenCalledWith(payload);
    expect(b).toHaveBeenCalledWith(payload);
  });

  it("registers the socket handler only once across subscriptions", async () => {
    const socket = makeSocket();
    mockGetSocket.mockReturnValue(socket);
    const { onTeamMembershipChanged } = await loadStore();

    onTeamMembershipChanged(vi.fn());
    onTeamMembershipChanged(vi.fn());

    expect(socket.on).toHaveBeenCalledOnce();
    expect(socket.on).toHaveBeenCalledWith(
      "team:membership-changed",
      expect.any(Function),
    );
  });

  it("stops notifying a listener after it unsubscribes", async () => {
    const socket = makeSocket();
    mockGetSocket.mockReturnValue(socket);
    const { onTeamMembershipChanged } = await loadStore();
    const stays = vi.fn();
    const leaves = vi.fn();

    onTeamMembershipChanged(stays);
    const unsubscribe = onTeamMembershipChanged(leaves);
    unsubscribe();
    socket.emit("team:membership-changed", payload);

    expect(stays).toHaveBeenCalledOnce();
    expect(leaves).not.toHaveBeenCalled();
  });

  it("retries socket registration on a later subscribe when no socket was available", async () => {
    const socket = makeSocket();
    mockGetSocket.mockReturnValueOnce(null).mockReturnValue(socket);
    const { onTeamMembershipChanged } = await loadStore();
    const early = vi.fn();

    onTeamMembershipChanged(early);
    onTeamMembershipChanged(vi.fn());
    socket.emit("team:membership-changed", payload);

    expect(socket.on).toHaveBeenCalledOnce();
    // Listeners added before the socket existed still receive events
    expect(early).toHaveBeenCalledWith(payload);
  });
});
