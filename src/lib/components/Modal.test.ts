import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ModalTestWrapper from "./ModalTestWrapper.svelte";

describe("Modal", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders dialog when open is true", () => {
    render(ModalTestWrapper, {
      props: { open: true, title: "Test Modal" } as never,
    });

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Test Modal")).toBeTruthy();
  });

  it("does not render when open is false", () => {
    render(ModalTestWrapper, {
      props: { open: false, title: "Test Modal" } as never,
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("displays the title", () => {
    render(ModalTestWrapper, {
      props: { open: true, title: "My Custom Title" } as never,
    });

    expect(screen.getByText("My Custom Title")).toBeTruthy();
  });

  it("has correct aria attributes", () => {
    render(ModalTestWrapper, {
      props: { open: true, title: "My Dialog" } as never,
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("my-dialog-title");
  });

  it("closes on Escape key press", async () => {
    render(ModalTestWrapper, {
      props: { open: true, title: "Test Modal" } as never,
    });

    expect(screen.getByRole("dialog")).toBeTruthy();

    await fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on backdrop click", async () => {
    render(ModalTestWrapper, {
      props: { open: true, title: "Test Modal" } as never,
    });

    expect(screen.getByRole("dialog")).toBeTruthy();

    await fireEvent.click(screen.getByRole("dialog"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not close when clicking inside modal content", async () => {
    render(ModalTestWrapper, {
      props: { open: true, title: "Test Modal" } as never,
    });

    expect(screen.getByRole("dialog")).toBeTruthy();

    await fireEvent.click(screen.getByText("Test Modal"));

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("calls onclose callback when closing", async () => {
    const onclose = vi.fn();

    render(ModalTestWrapper, {
      props: { open: true, title: "Test Modal", onclose } as never,
    });

    await fireEvent.keyDown(window, { key: "Escape" });

    expect(onclose).toHaveBeenCalledOnce();
  });

  it("supports describedBy prop", () => {
    render(ModalTestWrapper, {
      props: {
        open: true,
        title: "Test Modal",
        describedBy: "my-desc",
      } as never,
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-describedby")).toBe("my-desc");
  });

  it("renders close button with aria-label", () => {
    render(ModalTestWrapper, {
      props: { open: true, title: "Test Modal" } as never,
    });

    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});
