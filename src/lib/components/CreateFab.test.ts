import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CreateFab from "./CreateFab.svelte";

describe("CreateFab", () => {
  it("renders an anchor linking to /create", () => {
    const { container } = render(CreateFab);
    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/create");
  });

  it('has aria-label "Create counter"', () => {
    const { container } = render(CreateFab);
    const link = container.querySelector("a");
    expect(link?.getAttribute("aria-label")).toBe("Create counter");
  });

  it("ion-icon has aria-hidden true", () => {
    const { container } = render(CreateFab);
    const icon = container.querySelector("ion-icon");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });
});
