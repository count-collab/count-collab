import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { counters } from "../src/lib/db/schema";

test("private counter without cooldown bypasses global increment cooldown", async ({
  request,
}) => {
  const counterId = crypto.randomUUID();
  const shareToken = `e2e-token-${Date.now()}`;

  await db.insert(counters).values({
    id: counterId,
    title: "E2E Private Cooldown Counter",
    visibilityMode: "private",
    isPublic: 0,
    shareToken,
    cooldownEnabled: false,
    cooldownSeconds: 5,
  });

  try {
    const firstIncrement = await request.post(
      `/api/counters/${counterId}?token=${shareToken}`,
    );
    expect(firstIncrement.status()).toBe(200);
    await expect(firstIncrement).toBeOK();
    expect(await firstIncrement.json()).toMatchObject({
      count: 1,
      cooldownSeconds: 0,
      amount: 1,
      username: null,
    });

    // Private counters still have a minimal debounce safeguard (100ms).
    await new Promise((resolve) => setTimeout(resolve, 150));

    const secondIncrement = await request.post(
      `/api/counters/${counterId}?token=${shareToken}`,
    );
    expect(secondIncrement.status()).toBe(200);
    await expect(secondIncrement).toBeOK();
    expect(await secondIncrement.json()).toMatchObject({
      count: 2,
      cooldownSeconds: 0,
      amount: 1,
      username: null,
    });
  } finally {
    await db.delete(counters).where(eq(counters.id, counterId));
  }
});
