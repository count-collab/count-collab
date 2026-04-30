import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import FloatingUsername from "./FloatingUsername.svelte";

describe("FloatingUsername", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when usernames array is empty", () => {
    const { container } = render(FloatingUsername, {
      props: { usernames: [], oncomplete: () => {} },
    });

    const spans = container.querySelectorAll("span");
    expect(spans).toHaveLength(0);
  });

  it("renders username text when an entry is provided", () => {
    render(FloatingUsername, {
      props: {
        usernames: [{ id: 1, username: "Alice", amount: 1 }],
        oncomplete: () => {},
      },
    });

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
  });

  it("renders multiple usernames when array has multiple entries", () => {
    render(FloatingUsername, {
      props: {
        usernames: [
          { id: 1, username: "Alice", amount: 1 },
          { id: 2, username: "Bob", amount: 1 },
          { id: 3, username: "Charlie", amount: -1 },
        ],
        oncomplete: () => {},
      },
    });

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Charlie")).toBeTruthy();
    expect(screen.getByText("-1")).toBeTruthy();
  });

  it('renders "Anonymous" when passed as the username string', () => {
    render(FloatingUsername, {
      props: {
        usernames: [{ id: 1, username: "Anonymous", amount: 1 }],
        oncomplete: () => {},
      },
    });

    expect(screen.getByText("Anonymous")).toBeTruthy();
  });

  it("applies small variant classes when size is sm", () => {
    const { container } = render(FloatingUsername, {
      props: {
        usernames: [{ id: 1, username: "Alice", amount: 1 }],
        oncomplete: () => {},
        size: "sm",
      },
    });

    const span = container.querySelector(".floating-username-sm");
    expect(span).toBeTruthy();
  });
});
