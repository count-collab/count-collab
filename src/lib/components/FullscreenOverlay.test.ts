import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FullscreenOverlayTestWrapper from "./FullscreenOverlayTestWrapper.svelte";

function overlay() {
  return screen.queryByRole("dialog", { name: "Test Overlay" });
}

describe("FullscreenOverlay", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("renders a dialog named by its title when open", () => {
    render(FullscreenOverlayTestWrapper, { props: { open: true } });

    const dialog = overlay();
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Overlay content")).toBeTruthy();
  });

  it("does not render when closed", () => {
    render(FullscreenOverlayTestWrapper, { props: { open: false } });

    expect(overlay()).toBeNull();
  });

  it("locks body scroll while open", async () => {
    render(FullscreenOverlayTestWrapper, { props: { open: true } });
    expect(document.body.style.overflow).toBe("hidden");

    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps body scroll locked until both a stacked Modal and the overlay close", async () => {
    render(FullscreenOverlayTestWrapper, { props: { open: true } });
    await fireEvent.click(screen.getByRole("button", { name: "Open confirm" }));
    expect(document.body.style.overflow).toBe("hidden");

    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Confirm" })).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");

    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
  });

  it("releases body scroll when the overlay closes while a Modal is still open", async () => {
    render(FullscreenOverlayTestWrapper, { props: { open: true } });
    await fireEvent.click(screen.getByRole("button", { name: "Open confirm" }));

    // First "Close" in DOM order is the overlay header button
    const [overlayClose] = screen.getAllByRole("button", { name: "Close" });
    await fireEvent.click(overlayClose);

    await vi.waitFor(() => expect(overlay()).toBeNull());
    expect(document.body.style.overflow).toBe("");
  });

  it("closes via the close button and calls onclose", async () => {
    const onclose = vi.fn();
    render(FullscreenOverlayTestWrapper, { props: { open: true, onclose } });

    await fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await vi.waitFor(() => expect(overlay()).toBeNull());
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("closes on Escape and calls onclose", async () => {
    const onclose = vi.fn();
    render(FullscreenOverlayTestWrapper, { props: { open: true, onclose } });

    await fireEvent.keyDown(window, { key: "Escape" });

    await vi.waitFor(() => expect(overlay()).toBeNull());
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("renders the footer snippet only when provided", () => {
    render(FullscreenOverlayTestWrapper, {
      props: { open: true, withFooter: true },
    });
    expect(screen.getByRole("button", { name: "Footer action" })).toBeTruthy();
    cleanup();

    render(FullscreenOverlayTestWrapper, { props: { open: true } });
    expect(screen.queryByRole("button", { name: "Footer action" })).toBeNull();
  });

  it("closes only a nested Modal on Escape", async () => {
    const onclose = vi.fn();
    render(FullscreenOverlayTestWrapper, { props: { open: true, onclose } });

    await fireEvent.click(screen.getByRole("button", { name: "Open confirm" }));
    expect(screen.getByRole("dialog", { name: "Confirm" })).toBeTruthy();

    await fireEvent.keyDown(document.body, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Confirm" })).toBeNull();
    expect(overlay()).toBeTruthy();
    expect(onclose).not.toHaveBeenCalled();

    await fireEvent.keyDown(document.body, { key: "Escape" });

    await vi.waitFor(() => expect(overlay()).toBeNull());
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("moves focus into the dialog and restores it on close", async () => {
    render(FullscreenOverlayTestWrapper, { props: { open: false } });

    const trigger = screen.getByRole("button", { name: "Open overlay" });
    trigger.focus();
    await fireEvent.click(trigger);

    await vi.waitFor(() => expect(document.activeElement).toBe(overlay()));

    await fireEvent.keyDown(window, { key: "Escape" });

    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
