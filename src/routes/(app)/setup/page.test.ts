import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/forms", () => ({
  enhance: () => ({ destroy() {} }),
}));

vi.mock("$app/stores", async () => {
  const { readable } = await import("svelte/store");
  return { page: readable({ url: new URL("http://localhost/setup") }) };
});

const { default: Page } = await import("./+page.svelte");

const fetchMock = vi.fn();

function renderPage(form: Record<string, unknown> | null = null) {
  return render(Page, {
    props: { data: { session: null } as never, form: form as never },
  });
}

function typeUsername(value: string) {
  const input = screen.getByLabelText("Username") as HTMLInputElement;
  input.value = value;
  return fireEvent.input(input);
}

function respondAvailable(available: boolean) {
  fetchMock.mockResolvedValueOnce({ json: async () => ({ available }) });
}

describe("Setup page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("uses the bodyless underline input style", () => {
    renderPage();
    const input = screen.getByLabelText("Username");
    expect(input.className).toContain("border-b-2");
    expect(input.className).toContain("bg-transparent");
  });

  it("shows no indicator for fewer than 3 characters", async () => {
    renderPage();
    await typeUsername("ab");

    expect(screen.queryByTestId("username-checking")).toBeNull();
    expect(screen.queryByTestId("username-available")).toBeNull();
    expect(screen.queryByTestId("username-taken")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a spinner while checking, then a checkmark when available", async () => {
    respondAvailable(true);
    renderPage();
    await typeUsername("alice");

    expect(screen.getByTestId("username-checking")).toBeTruthy();
    expect(screen.queryByText(/Checking availability\.\.\./)).toBeNull();

    await waitFor(() =>
      expect(screen.getByTestId("username-available")).toBeTruthy(),
    );
    expect(screen.queryByTestId("username-checking")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/username/check?username=alice",
    );
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("shows an X and disables submit when the name is taken", async () => {
    respondAvailable(false);
    renderPage();
    await typeUsername("taken_name");

    await waitFor(() =>
      expect(screen.getByTestId("username-taken")).toBeTruthy(),
    );
    expect(screen.getByLabelText("Username").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("stops the spinner when the input drops below 3 characters", async () => {
    renderPage();
    await typeUsername("alice");
    expect(screen.getByTestId("username-checking")).toBeTruthy();

    await typeUsername("al");
    expect(screen.queryByTestId("username-checking")).toBeNull();
  });

  it("shows server errors from the form action", () => {
    renderPage({ username: "bob", error: "This username is already taken" });
    expect(screen.getByRole("alert").textContent).toContain(
      "This username is already taken",
    );
  });
});
