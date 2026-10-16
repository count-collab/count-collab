import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvalidateAll, fetchMock } = vi.hoisted(() => ({
  mockInvalidateAll: vi.fn(async () => {}),
  fetchMock: vi.fn(),
}));

vi.mock("$app/navigation", () => ({ invalidateAll: mockInvalidateAll }));

vi.stubGlobal("fetch", fetchMock);

const { default: TransferOwnershipSection } =
  await import("./TransferOwnershipSection.svelte");

const alpha = { id: "team-a", name: "Alpha" };
const beta = { id: "team-b", name: "Beta" };

type Props = {
  type: "counter" | "dashboard";
  entityId: string;
  team: { id: string; name: string } | null;
  transferTargets: { id: string; name: string }[];
  dashboardCounters?: {
    id: string;
    title: string | null;
    teamId: string | null;
    owned: boolean;
  }[];
  ontransferred?: () => void;
};

function renderSection(props: Partial<Props> = {}) {
  return render(TransferOwnershipSection, {
    props: {
      type: "counter",
      entityId: "entity-1",
      team: null,
      transferTargets: [alpha],
      ...props,
    } as Props,
  });
}

function okResponse() {
  return { ok: true, json: async () => ({ ok: true }) };
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, body: JSON.parse(init.body as string) };
}

async function openConfirm() {
  await fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
  return screen.getByRole("dialog");
}

async function confirm(dialog: HTMLElement) {
  await fireEvent.click(
    within(dialog).getByRole("button", { name: "Transfer" }),
  );
}

function optionLabels() {
  return Array.from(
    (screen.getByLabelText("Move to") as HTMLSelectElement).options,
  ).map((o) => o.textContent);
}

describe("TransferOwnershipSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(okResponse());
  });

  afterEach(() => {
    cleanup();
  });

  describe("target options", () => {
    it("describes a personally owned entity and omits the Personal option", () => {
      renderSection({ transferTargets: [alpha, beta] });

      expect(screen.getByText(/This counter is owned by you\./)).toBeTruthy();
      expect(optionLabels()).toEqual(["Alpha", "Beta"]);
    });

    it("offers 'Personal (me)' first when the entity is team-owned", () => {
      renderSection({
        type: "dashboard",
        team: alpha,
        transferTargets: [beta],
      });

      expect(
        screen.getByText(/This dashboard is owned by the team/).textContent,
      ).toContain("Alpha");
      expect(optionLabels()).toEqual(["Personal (me)", "Beta"]);
    });

    it("explains how to get access when there is nowhere to move to", () => {
      renderSection({ transferTargets: [] });

      expect(screen.queryByLabelText("Move to")).toBeNull();
      expect(screen.queryByRole("button", { name: "Transfer" })).toBeNull();
      expect(
        screen.getByRole("link", { name: "Manage teams" }).getAttribute("href"),
      ).toBe("/my/teams");
    });
  });

  describe("confirm dialog", () => {
    it("names the target team and the current team losing access", async () => {
      renderSection({ team: alpha, transferTargets: [beta] });

      await fireEvent.change(screen.getByLabelText("Move to"), {
        target: { value: "team-b" },
      });
      const dialog = await openConfirm();

      expect(dialog.textContent).toContain("will be owned by");
      expect(dialog.textContent).toContain("Beta");
      expect(dialog.textContent).toContain(
        "Members of Alpha will no longer have access",
      );
    });

    it("tells the user they become owner when moving to personal", async () => {
      renderSection({ team: alpha, transferTargets: [beta] });

      const dialog = await openConfirm();

      expect(dialog.textContent).toContain(
        "You will become the owner of this counter.",
      );
    });

    it("closes on Cancel without calling the API", async () => {
      renderSection();

      const dialog = await openConfirm();
      await fireEvent.click(
        within(dialog).getByRole("button", { name: "Cancel" }),
      );

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("closes on Escape without letting the key reach outer handlers", async () => {
      const outer = vi.fn();
      document.addEventListener("keydown", outer);
      renderSection();

      await openConfirm();
      await fireEvent.keyDown(document.body, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(outer).not.toHaveBeenCalled();
      document.removeEventListener("keydown", outer);
    });
  });

  describe("dashboard counter checklist", () => {
    const dashboardCounters = [
      { id: "c1", title: "Mine one", teamId: null, owned: true },
      { id: "c2", title: "Mine two", teamId: null, owned: true },
      { id: "c3", title: "Team counter", teamId: "team-a", owned: false },
      { id: "c4", title: null, teamId: null, owned: false },
    ];

    it("pre-checks every counter the user owns", async () => {
      renderSection({ type: "dashboard", dashboardCounters });

      const dialog = await openConfirm();
      const boxes = within(dialog).getAllByRole(
        "checkbox",
      ) as HTMLInputElement[];

      expect(boxes.map((b) => b.value)).toEqual(["c1", "c2"]);
      expect(boxes.every((b) => b.checked)).toBe(true);
    });

    it("lists counters not owned by the user with the right hint", async () => {
      renderSection({ type: "dashboard", dashboardCounters });

      const dialog = await openConfirm();
      const items = within(dialog).getAllByRole("listitem");

      expect(items[0].textContent).toContain("Team counter");
      expect(items[0].textContent).toContain("Already owned by Alpha");
      expect(items[1].textContent).toContain("Private counter");
      expect(items[1].textContent).toContain("Not owned by you");
    });

    it("sends only the counters that remain checked", async () => {
      renderSection({ type: "dashboard", dashboardCounters });

      const dialog = await openConfirm();
      await fireEvent.click(
        within(dialog).getByRole("checkbox", { name: "Mine two" }),
      );
      await confirm(dialog);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      expect(lastRequest()).toEqual({
        url: "/api/dashboards/entity-1/transfer",
        body: { teamId: "team-a", counterIds: ["c1"] },
      });
    });

    it("re-checks all owned counters each time the dialog opens", async () => {
      renderSection({ type: "dashboard", dashboardCounters });

      let dialog = await openConfirm();
      await fireEvent.click(
        within(dialog).getByRole("checkbox", { name: "Mine one" }),
      );
      await fireEvent.click(
        within(dialog).getByRole("button", { name: "Cancel" }),
      );
      dialog = await openConfirm();

      const boxes = within(dialog).getAllByRole(
        "checkbox",
      ) as HTMLInputElement[];
      expect(boxes.every((b) => b.checked)).toBe(true);
    });

    it("hides the checklist and sends no counters when moving to personal", async () => {
      renderSection({
        type: "dashboard",
        team: alpha,
        transferTargets: [beta],
        dashboardCounters,
      });

      const dialog = await openConfirm();
      expect(within(dialog).queryByRole("checkbox")).toBeNull();
      await confirm(dialog);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      expect(lastRequest().body).toEqual({ teamId: null, counterIds: [] });
    });

    it("omits the owned-counters fieldset when the user owns none", async () => {
      renderSection({
        type: "dashboard",
        dashboardCounters: [dashboardCounters[2]],
      });

      const dialog = await openConfirm();

      expect(within(dialog).queryByRole("group")).toBeNull();
      expect(dialog.textContent).toContain("Other counters on this dashboard");
    });
  });

  describe("submitting", () => {
    it("posts only the teamId for counters, refreshes data and notifies the parent", async () => {
      const ontransferred = vi.fn();
      renderSection({ ontransferred });

      await confirm(await openConfirm());

      await waitFor(() => expect(ontransferred).toHaveBeenCalledOnce());
      expect(lastRequest()).toEqual({
        url: "/api/counters/entity-1/transfer",
        body: { teamId: "team-a" },
      });
      expect(mockInvalidateAll).toHaveBeenCalledOnce();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it.each([
      [{ message: "Not allowed" }, "Not allowed"],
      [{ error: "Team not found" }, "Team not found"],
      [{}, "Failed to transfer counter."],
    ])(
      "shows the API error %j and keeps the dialog open",
      async (body, text) => {
        fetchMock.mockResolvedValue({ ok: false, json: async () => body });
        const ontransferred = vi.fn();
        renderSection({ ontransferred });

        const dialog = await openConfirm();
        await confirm(dialog);

        expect(await within(dialog).findByText(text)).toBeTruthy();
        expect(screen.getByRole("dialog")).toBeTruthy();
        expect(mockInvalidateAll).not.toHaveBeenCalled();
        expect(ontransferred).not.toHaveBeenCalled();
      },
    );

    it("falls back to a generic message when the error body is not JSON", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("bad json");
        },
      });
      renderSection({ type: "dashboard" });

      const dialog = await openConfirm();
      await confirm(dialog);

      expect(
        await within(dialog).findByText("Failed to transfer dashboard."),
      ).toBeTruthy();
    });

    it("shows a network error when the request fails", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      renderSection();

      const dialog = await openConfirm();
      await confirm(dialog);

      expect(
        await within(dialog).findByText("Network error. Please try again."),
      ).toBeTruthy();
    });

    it("clears a previous error when the dialog is reopened", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Nope" }),
      });
      renderSection();

      let dialog = await openConfirm();
      await confirm(dialog);
      await within(dialog).findByText("Nope");
      await fireEvent.click(
        within(dialog).getByRole("button", { name: "Cancel" }),
      );
      dialog = await openConfirm();

      expect(within(dialog).queryByText("Nope")).toBeNull();
    });
  });
});
