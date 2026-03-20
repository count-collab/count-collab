import { render } from "@testing-library/svelte";
import { beforeAll, describe, expect, it, vi } from "vitest";
import Fireworks from "./Fireworks.svelte";

// Mock $app/environment
vi.mock("$app/environment", () => ({ browser: true }));

// jsdom lacks ResizeObserver
beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as unknown as typeof ResizeObserver;
});

describe("Fireworks", () => {
    it("renders a canvas element", () => {
        const { container } = render(Fireworks, { props: { trigger: 0 } });
        const canvas = container.querySelector("canvas");
        expect(canvas).toBeTruthy();
    });

    it("canvas has pointer-events-none and aria-hidden", () => {
        const { container } = render(Fireworks, { props: { trigger: 0 } });
        const canvas = container.querySelector("canvas");
        expect(canvas?.getAttribute("aria-hidden")).toBe("true");
        expect(canvas?.classList.contains("pointer-events-none")).toBe(true);
    });

    it("canvas is positioned absolutely to fill parent", () => {
        const { container } = render(Fireworks, { props: { trigger: 0 } });
        const canvas = container.querySelector("canvas");
        expect(canvas?.classList.contains("absolute")).toBe(true);
        expect(canvas?.classList.contains("inset-0")).toBe(true);
    });
});
