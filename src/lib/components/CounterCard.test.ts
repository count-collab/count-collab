import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import CounterCard from "./CounterCard.svelte";

describe("CounterCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows Owner badge when badges are enabled and counter has an owner", () => {
    render(CounterCard, {
      props: {
        counter: {
          id: "counter-1",
          title: "Test Counter",
          description: "Counter description",
          count: 7,
          isPublic: true,
          visibilityMode: "public",
          ownerId: "owner-1",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-02T00:00:00.000Z",
          shareToken: null,
        },
        showBadges: true,
      } as never,
    });

    expect(screen.getByText("Owner")).toBeTruthy();
  });
});
