import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsert = vi.fn();
const mockValues = vi.fn();

vi.mock("$lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("$lib/db/schema", () => ({
  platformEvents: Symbol("platformEvents"),
}));

vi.mock("$lib/server/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

mockInsert.mockReturnValue({ values: mockValues });

import { platformEvents } from "$lib/db/schema";
import { logger } from "$lib/server/logger";
import { logEvent, logEventInTx } from "./events";

describe("logEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);
  });

  it("inserts into platformEvents with correct values", async () => {
    await logEvent({
      eventType: "counter_created",
      userId: "user-1",
      entityId: "counter-1",
      entityType: "counter",
      metadata: { source: "api" },
    });

    expect(mockInsert).toHaveBeenCalledWith(platformEvents);
    expect(mockValues).toHaveBeenCalledWith({
      eventType: "counter_created",
      userId: "user-1",
      entityId: "counter-1",
      entityType: "counter",
      metadata: { source: "api" },
    });
  });

  it("defaults optional fields to null and empty object", async () => {
    await logEvent({ eventType: "user_registered" });

    expect(mockValues).toHaveBeenCalledWith({
      eventType: "user_registered",
      userId: null,
      entityId: null,
      entityType: null,
      metadata: {},
    });
  });

  it("does not throw on DB errors (fire-and-forget)", async () => {
    mockValues.mockRejectedValueOnce(new Error("connection refused"));

    await expect(
      logEvent({ eventType: "counter_deleted" }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith("Failed to log platform event", {
      eventType: "counter_deleted",
      error: "connection refused",
    });
  });

  it("logs stringified error when error is not an Error instance", async () => {
    mockValues.mockRejectedValueOnce("some string error");

    await expect(
      logEvent({ eventType: "counter_deleted" }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith("Failed to log platform event", {
      eventType: "counter_deleted",
      error: "some string error",
    });
  });
});

describe("logEventInTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts using the provided transaction object", async () => {
    const mockTxValues = vi.fn().mockResolvedValue(undefined);
    const mockTxInsert = vi.fn().mockReturnValue({ values: mockTxValues });
    const tx = { insert: mockTxInsert } as any;

    await logEventInTx(tx, {
      eventType: "counter_deleted",
      userId: "user-2",
      entityId: "counter-5",
      entityType: "counter",
      metadata: { reason: "cleanup" },
    });

    expect(mockTxInsert).toHaveBeenCalledWith(platformEvents);
    expect(mockTxValues).toHaveBeenCalledWith({
      eventType: "counter_deleted",
      userId: "user-2",
      entityId: "counter-5",
      entityType: "counter",
      metadata: { reason: "cleanup" },
    });
  });

  it("defaults optional fields to null and empty object", async () => {
    const mockTxValues = vi.fn().mockResolvedValue(undefined);
    const mockTxInsert = vi.fn().mockReturnValue({ values: mockTxValues });
    const tx = { insert: mockTxInsert } as any;

    await logEventInTx(tx, { eventType: "user_deleted" });

    expect(mockTxValues).toHaveBeenCalledWith({
      eventType: "user_deleted",
      userId: null,
      entityId: null,
      entityType: null,
      metadata: {},
    });
  });

  it("propagates DB errors (not fire-and-forget)", async () => {
    const mockTxValues = vi
      .fn()
      .mockRejectedValue(new Error("tx constraint violation"));
    const mockTxInsert = vi.fn().mockReturnValue({ values: mockTxValues });
    const tx = { insert: mockTxInsert } as any;

    await expect(
      logEventInTx(tx, { eventType: "counter_deleted" }),
    ).rejects.toThrow("tx constraint violation");
  });
});
