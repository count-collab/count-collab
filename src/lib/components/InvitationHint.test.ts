import { cleanup, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type NavigationCallback = (navigation: {
  type: string;
  to: { url: URL } | null;
}) => void;

const { callbacks } = vi.hoisted(() => ({
  callbacks: [] as NavigationCallback[],
}));

vi.mock("$app/navigation", () => ({
  afterNavigate: (cb: NavigationCallback) => callbacks.push(cb),
}));

const { default: InvitationHint } = await import("./InvitationHint.svelte");

async function navigate(type: string, path = "/home") {
  for (const cb of callbacks) {
    cb({ type, to: { url: new URL(`http://localhost${path}`) } });
  }
  await tick();
}

describe("InvitationHint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    callbacks.length = 0;
    vi.useRealTimers();
  });

  it("shows on the initial page load when invitations are pending", async () => {
    render(InvitationHint, { props: { count: 2 } });
    await navigate("enter");

    expect(screen.getByRole("status").textContent).toContain(
      "You have 2 pending invitations",
    );
  });

  it("uses the singular for one invitation", async () => {
    render(InvitationHint, { props: { count: 1 } });
    await navigate("enter");

    expect(screen.getByRole("status").textContent).toContain(
      "You have 1 pending invitation",
    );
    expect(screen.getByRole("status").textContent).not.toContain("invitations");
  });

  it("hides itself after a few seconds", async () => {
    render(InvitationHint, { props: { count: 2 } });
    await navigate("enter");
    expect(screen.queryByRole("status")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(6500);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each(["link", "goto", "popstate"])(
    "does not show after a %s navigation",
    async (type) => {
      render(InvitationHint, { props: { count: 2 } });
      await navigate(type);

      expect(screen.queryByRole("status")).toBeNull();
    },
  );

  it("hides when the user navigates away", async () => {
    render(InvitationHint, { props: { count: 2 } });
    await navigate("enter");
    await navigate("link", "/counters");
    await vi.advanceTimersByTimeAsync(300);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not show without pending invitations", async () => {
    render(InvitationHint, { props: { count: 0 } });
    await navigate("enter");

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not show when already on the invitations page", async () => {
    render(InvitationHint, { props: { count: 3 } });
    await navigate("enter", "/invitations");

    expect(screen.queryByRole("status")).toBeNull();
  });
});
