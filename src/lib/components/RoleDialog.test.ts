import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import RoleDialog from "./RoleDialog.svelte";

const roles = [
  { value: "viewer", label: "Viewer", description: "Can look." },
  { value: "editor", label: "Editor", description: "Can edit." },
  { value: "admin", label: "Admin", description: "Can manage." },
];

type Props = {
  open: boolean;
  title: string;
  currentRole: string;
  roles: typeof roles;
  onselect: (role: string) => boolean | undefined | Promise<boolean | undefined>;
  error?: string | null;
};

function renderDialog(props: Partial<Props> = {}) {
  const onselect = props.onselect ?? vi.fn();
  render(RoleDialog, {
    props: {
      open: true,
      title: "Change role for bob",
      currentRole: "viewer",
      roles,
      ...props,
      onselect,
    } as Props,
  });
  return { onselect };
}

const saveButton = () => screen.getByRole("button", { name: "Save" });

describe("RoleDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a card per role with its description", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Change role for bob" });
    const cards = within(dialog).getAllByRole("radio");
    expect(cards).toHaveLength(3);
    for (const role of roles) {
      const card = within(dialog).getByRole("radio", {
        name: new RegExp(`^${role.label}`),
      });
      expect(card.textContent).toContain(role.description);
    }
  });

  it("preselects the current role", () => {
    renderDialog({ currentRole: "editor" });
    const checked = screen
      .getAllByRole("radio")
      .filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toContain("Editor");
  });

  it("disables Save while the selection is unchanged", async () => {
    renderDialog();
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);

    await fireEvent.click(screen.getByRole("radio", { name: /^Admin/ }));
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);

    await fireEvent.click(screen.getByRole("radio", { name: /^Viewer/ }));
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls onselect with the chosen role and closes", async () => {
    const { onselect } = renderDialog();
    await fireEvent.click(screen.getByRole("radio", { name: /^Admin/ }));
    await fireEvent.click(saveButton());

    await waitFor(() => expect(onselect).toHaveBeenCalledWith("admin"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays open when onselect returns false", async () => {
    const onselect = vi.fn(async () => false);
    renderDialog({ onselect, error: "Could not save" });
    await fireEvent.click(screen.getByRole("radio", { name: /^Admin/ }));
    await fireEvent.click(saveButton());

    await waitFor(() => expect(onselect).toHaveBeenCalledWith("admin"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Could not save");
    await waitFor(() =>
      expect((saveButton() as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("closes on Cancel without calling onselect", async () => {
    const { onselect } = renderDialog();
    await fireEvent.click(screen.getByRole("radio", { name: /^Admin/ }));
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onselect).not.toHaveBeenCalled();
  });

  it("moves the selection with arrow keys", async () => {
    renderDialog();
    await fireEvent.keyDown(screen.getByRole("radio", { name: /^Viewer/ }), {
      key: "ArrowDown",
    });
    expect(
      screen
        .getByRole("radio", { name: /^Editor/ })
        .getAttribute("aria-checked"),
    ).toBe("true");

    await fireEvent.keyDown(screen.getByRole("radio", { name: /^Editor/ }), {
      key: "ArrowUp",
    });
    await fireEvent.keyDown(screen.getByRole("radio", { name: /^Viewer/ }), {
      key: "ArrowUp",
    });
    expect(
      screen
        .getByRole("radio", { name: /^Admin/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });
});
